import uuid
from typing import List
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.bid import Bid


async def recompute_ranks(session: AsyncSession, rfq_id: uuid.UUID) -> List[Bid]:
    """
    Atomically recomputes sequential ranks (L1, L2, L3...) for all active bids in an RFQ.
    Lower total_charges wins (Rank 1 = lowest price).
    Tie-breaker: earlier submitted_at timestamp wins.
    """
    stmt = (
        select(Bid)
        .where(Bid.rfq_id == rfq_id, Bid.is_active == True)
        .order_by(Bid.total_charges.asc(), Bid.submitted_at.asc())
    )
    result = await session.execute(stmt)
    active_bids = list(result.scalars().all())

    # Assign dense sequential ranks
    for index, bid in enumerate(active_bids, start=1):
        if bid.rank != index:
            bid.rank = index
            session.add(bid)

    await session.flush()
    return active_bids

