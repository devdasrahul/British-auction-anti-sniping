import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Tuple, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.rfq import RFQ, RFQStatus, RFQSupplier
from app.models.bid import Bid
from app.models.activity_log import AuctionActivityLog, ActivityEventType
from app.schemas.bid import BidCreate
from app.services.ranking_service import recompute_ranks
from app.services.auction_engine import evaluate_british_auction_extension, ExtensionResult


async def submit_quote(
    session: AsyncSession,
    rfq_id: uuid.UUID,
    supplier_id: uuid.UUID,
    supplier_name: str,
    bid_in: BidCreate,
) -> Tuple[Bid, List[Bid], Optional[ExtensionResult]]:
    """
    Submits or updates a supplier's quote inside an atomic transaction.
    1. Validates RFQ is active and open for bidding.
    2. Enforces reverse auction rule: re-bids must be strictly lower.
    3. Supersedes previous quote (is_active = False).
    4. Inserts new quote with auto-computed total charges.
    5. Atomically recomputes ranks for all active quotes on this RFQ.
    6. Executes the British Auction Extension Engine.
    """
    now = datetime.now(timezone.utc)

    # 1. Lock and fetch RFQ
    stmt_rfq = (
        select(RFQ)
        .where(RFQ.id == rfq_id)
        .options(selectinload(RFQ.auction_config))
        .with_for_update()
    )
    res_rfq = await session.execute(stmt_rfq)
    rfq = res_rfq.scalar_one_or_none()

    if not rfq:
        raise ValueError("RFQ not found")

    if rfq.status != RFQStatus.ACTIVE:
        raise ValueError(f"Auction is not active. Current status: {rfq.status}")

    # Timezone normalization
    start_time = rfq.bid_start_time if rfq.bid_start_time.tzinfo else rfq.bid_start_time.replace(tzinfo=timezone.utc)
    close_time = rfq.bid_close_time if rfq.bid_close_time.tzinfo else rfq.bid_close_time.replace(tzinfo=timezone.utc)
    forced_time = rfq.forced_close_time if rfq.forced_close_time.tzinfo else rfq.forced_close_time.replace(tzinfo=timezone.utc)

    if now < start_time:
        raise ValueError("Auction has not started yet. Bids are not accepted.")
    if now > close_time or now >= forced_time:
        raise ValueError("Auction bidding window is closed.")

    # Verify supplier is invited
    stmt_invite = select(RFQSupplier).where(
        RFQSupplier.rfq_id == rfq_id, RFQSupplier.supplier_id == supplier_id
    )
    res_invite = await session.execute(stmt_invite)
    if not res_invite.scalar_one_or_none():
        raise PermissionError("You are not invited to participate in this RFQ.")

    # 2. Auto-compute Total Charges
    freight = Decimal(str(bid_in.freight_charges))
    origin = Decimal(str(bid_in.origin_charges))
    dest = Decimal(str(bid_in.destination_charges))
    total_charges = freight + origin + dest

    # 3. Check for previous active quote (Re-bidding logic)
    stmt_prev = select(Bid).where(
        Bid.rfq_id == rfq_id, Bid.supplier_id == supplier_id, Bid.is_active == True
    )
    res_prev = await session.execute(stmt_prev)
    old_bid = res_prev.scalar_one_or_none()

    if old_bid:
        if total_charges >= old_bid.total_charges:
            raise ValueError(
                f"In a reverse auction, your new quote (₹{total_charges:,.2f}) must be strictly lower than your previous active quote (₹{old_bid.total_charges:,.2f})."
            )
        old_bid.is_active = False
        session.add(old_bid)

    # 4. Snapshot previous rankings
    stmt_all_active = select(Bid).where(Bid.rfq_id == rfq_id, Bid.is_active == True)
    res_all_active = await session.execute(stmt_all_active)
    prior_bids = list(res_all_active.scalars().all())
    old_ranks = {b.supplier_id: b.rank for b in prior_bids}
    prev_l1_supplier = next((b.supplier_id for b in prior_bids if b.rank == 1), None)

    # 5. Insert New Quote
    new_bid = Bid(
        rfq_id=rfq_id,
        supplier_id=supplier_id,
        carrier_name=bid_in.carrier_name,
        freight_charges=freight,
        origin_charges=origin,
        destination_charges=dest,
        total_charges=total_charges,
        transit_time=bid_in.transit_time,
        quote_validity=bid_in.quote_validity,
        is_active=True,
    )
    session.add(new_bid)
    await session.flush()

    # 6. Atomically recompute ranks across all active quotes
    ranked_bids = await recompute_ranks(session, rfq_id)
    new_rank = new_bid.rank or 1

    # 7. Log BID_SUBMITTED
    bid_log = AuctionActivityLog(
        rfq_id=rfq_id,
        triggered_by_bid_id=new_bid.id,
        event_type=ActivityEventType.BID_SUBMITTED,
        description=f"{supplier_name} placed quote of ₹{total_charges:,.2f} via {new_bid.carrier_name} (Rank: L{new_rank})",
    )
    session.add(bid_log)

    # 8. Check rank change conditions for British Auction
    new_l1_supplier = next((b.supplier_id for b in ranked_bids if b.rank == 1), None)
    is_l1_change = (prev_l1_supplier != new_l1_supplier) if prev_l1_supplier else True

    is_any_rank_change = False
    for b in ranked_bids:
        if old_ranks.get(b.supplier_id) != b.rank:
            is_any_rank_change = True
            break

    # 9. Evaluate British Auction Extension Engine
    extension_result = await evaluate_british_auction_extension(
        session=session,
        rfq=rfq,
        new_bid=new_bid,
        is_l1_change=is_l1_change,
        is_any_rank_change=is_any_rank_change,
        supplier_name=supplier_name,
    )

    await session.commit()
    all_bids = await get_rfq_bids(session, rfq_id)
    curr_bid = next((b for b in all_bids if b.id == new_bid.id), new_bid)
    return curr_bid, all_bids, extension_result


async def get_rfq_bids(session: AsyncSession, rfq_id: uuid.UUID) -> List[Bid]:
    stmt = (
        select(Bid)
        .where(Bid.rfq_id == rfq_id, Bid.is_active == True)
        .options(selectinload(Bid.supplier))
        .order_by(Bid.rank.asc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())

