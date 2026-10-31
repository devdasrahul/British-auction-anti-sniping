import uuid
import time
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.rfq import RFQ, RFQStatus, RFQSupplier, InviteStatus
from app.models.auction_config import AuctionConfig
from app.models.bid import Bid
from app.models.activity_log import AuctionActivityLog, ActivityEventType
from app.schemas.rfq import RFQCreate


def generate_reference_id() -> str:
    ts = hex(int(time.time() * 1000))[2:].upper()
    return f"RFQ-{ts}"


async def create_rfq(
    session: AsyncSession, rfq_in: RFQCreate, creator_id: uuid.UUID, creator_name: str
) -> RFQ:
    now = datetime.now(timezone.utc)
    initial_status = RFQStatus.ACTIVE if now >= rfq_in.bid_start_time else RFQStatus.UPCOMING

    rfq = RFQ(
        name=rfq_in.name,
        reference_id=generate_reference_id(),
        created_by=creator_id,
        bid_start_time=rfq_in.bid_start_time,
        bid_close_time=rfq_in.bid_close_time,
        forced_close_time=rfq_in.forced_close_time,
        pickup_service_date=rfq_in.pickup_service_date,
        is_british_auction=rfq_in.is_british_auction,
        status=initial_status,
    )
    session.add(rfq)
    await session.flush()

    # Create 1:1 AuctionConfig if British Auction mode is enabled
    if rfq_in.is_british_auction and rfq_in.auction_config:
        config = AuctionConfig(
            rfq_id=rfq.id,
            trigger_window_minutes=rfq_in.auction_config.trigger_window_minutes,
            extension_duration_minutes=rfq_in.auction_config.extension_duration_minutes,
            trigger_type=rfq_in.auction_config.trigger_type,
        )
        session.add(config)

    # Invite suppliers
    for sup_id in rfq_in.supplier_ids:
        rfq_supplier = RFQSupplier(
            rfq_id=rfq.id,
            supplier_id=sup_id,
            invite_status=InviteStatus.ACCEPTED,
        )
        session.add(rfq_supplier)

    # Initial Activity Log
    activity_log = AuctionActivityLog(
        rfq_id=rfq.id,
        event_type=ActivityEventType.RFQ_CREATED,
        description=f"RFQ '{rfq.name}' published by {creator_name} (British Auction: {rfq.is_british_auction})",
    )
    session.add(activity_log)

    await session.commit()
    return await get_rfq_by_id(session, rfq.id)


async def get_rfq_by_id(
    session: AsyncSession, rfq_id: uuid.UUID, for_update: bool = False
) -> Optional[RFQ]:
    stmt = (
        select(RFQ)
        .where(RFQ.id == rfq_id)
        .options(
            selectinload(RFQ.auction_config),
            selectinload(RFQ.creator),
            selectinload(RFQ.bids.and_(Bid.is_active == True)).selectinload(Bid.supplier),
            selectinload(RFQ.activity_logs),
        )
    )
    if for_update:
        stmt = stmt.with_for_update()
    
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def list_rfqs(
    session: AsyncSession,
    user_id: uuid.UUID,
    user_role: str,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
) -> List[dict]:
    stmt = (
        select(RFQ)
        .options(
            selectinload(RFQ.auction_config),
            selectinload(RFQ.bids.and_(Bid.is_active == True, Bid.rank == 1)),
        )
        .order_by(RFQ.created_at.desc())
    )

    if status_filter and status_filter != "ALL":
        stmt = stmt.where(RFQ.status == status_filter)

    if search:
        stmt = stmt.where(RFQ.name.ilike(f"%{search}%"))

    if user_role == "BUYER":
        stmt = stmt.where(RFQ.created_by == user_id)
    elif user_role == "SUPPLIER":
        stmt = stmt.join(RFQ.suppliers).where(RFQSupplier.supplier_id == user_id)

    result = await session.execute(stmt)
    rfqs = list(result.scalars().all())

    # Map with lowest bid and bid count
    items = []
    for r in rfqs:
        lowest_bid_val = r.bids[0].total_charges if r.bids else None
        items.append({
            "id": r.id,
            "name": r.name,
            "reference_id": r.reference_id,
            "status": r.status,
            "bid_start_time": r.bid_start_time,
            "bid_close_time": r.bid_close_time,
            "forced_close_time": r.forced_close_time,
            "pickup_service_date": r.pickup_service_date,
            "is_british_auction": r.is_british_auction,
            "current_lowest_bid": lowest_bid_val,
            "created_at": r.created_at,
        })
    return items


async def award_rfq(
    session: AsyncSession, rfq_id: uuid.UUID, bid_id: uuid.UUID, buyer_id: uuid.UUID
) -> RFQ:
    rfq = await get_rfq_by_id(session, rfq_id)
    if not rfq:
        raise ValueError("RFQ not found")
    if rfq.created_by != buyer_id:
        raise PermissionError("Only the creator of this RFQ can award quotes")

    target_bid = None
    for b in rfq.bids:
        if b.id == bid_id and b.is_active:
            target_bid = b
            break

    if not target_bid:
        raise ValueError("Selected bid not found on this RFQ")

    rfq.status = RFQStatus.AWARDED
    rfq.awarded_bid_id = target_bid.id
    session.add(rfq)

    log = AuctionActivityLog(
        rfq_id=rfq.id,
        triggered_by_bid_id=target_bid.id,
        event_type=ActivityEventType.QUOTE_AWARDED,
        description=f"Contract awarded to {target_bid.carrier_name} at total ₹{target_bid.total_charges:,.2f}",
    )
    session.add(log)

    await session.commit()
    return await get_rfq_by_id(session, rfq.id)

