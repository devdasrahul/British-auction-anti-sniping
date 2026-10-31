import logging
from datetime import datetime, timezone
from sqlalchemy import select, update
from app.core.database import AsyncSessionLocal
from app.models.rfq import RFQ, RFQStatus
from app.models.activity_log import AuctionActivityLog, ActivityEventType

logger = logging.getLogger(__name__)


async def update_auction_statuses() -> None:
    """
    Background worker task to transition RFQ auction states:
    1. FORCE_CLOSED: auctions whose forced_close_time has arrived.
    2. CLOSED: auctions whose rolling bid_close_time has elapsed.
    3. ACTIVE: auctions whose bid_start_time has arrived.
    """
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as session:
        try:
            # 1. Force close auctions passing forced_close_time (Hard Deadline)
            stmt_force = (
                select(RFQ)
                .where(RFQ.status == RFQStatus.ACTIVE, RFQ.forced_close_time <= now)
            )
            result = await session.execute(stmt_force)
            force_closed_rfqs = list(result.scalars().all())

            for rfq in force_closed_rfqs:
                rfq.status = RFQStatus.FORCE_CLOSED
                session.add(rfq)
                log = AuctionActivityLog(
                    rfq_id=rfq.id,
                    event_type=ActivityEventType.FORCE_CLOSED,
                    description="Auction reached its Forced Bid Close Time (hard deadline) and terminated.",
                )
                session.add(log)

            if force_closed_rfqs:
                logger.info(f"🔴 Force-closed {len(force_closed_rfqs)} auction(s)")

            # 2. Regularly close auctions passing bid_close_time
            stmt_close = (
                select(RFQ)
                .where(
                    RFQ.status == RFQStatus.ACTIVE,
                    RFQ.bid_close_time <= now,
                    RFQ.forced_close_time > now,
                )
            )
            result_close = await session.execute(stmt_close)
            closed_rfqs = list(result_close.scalars().all())

            for rfq in closed_rfqs:
                rfq.status = RFQStatus.CLOSED
                session.add(rfq)
                log = AuctionActivityLog(
                    rfq_id=rfq.id,
                    event_type=ActivityEventType.AUCTION_CLOSED,
                    description="Auction concluded normally at bid close time without further extensions.",
                )
                session.add(log)

            if closed_rfqs:
                logger.info(f"🟡 Concluded {len(closed_rfqs)} auction(s)")

            # 3. Activate upcoming auctions
            stmt_activate = (
                select(RFQ)
                .where(
                    RFQ.status == RFQStatus.UPCOMING,
                    RFQ.bid_start_time <= now,
                    RFQ.bid_close_time > now,
                )
            )
            result_activate = await session.execute(stmt_activate)
            activated_rfqs = list(result_activate.scalars().all())

            for rfq in activated_rfqs:
                rfq.status = RFQStatus.ACTIVE
                session.add(rfq)
                log = AuctionActivityLog(
                    rfq_id=rfq.id,
                    event_type=ActivityEventType.AUCTION_STARTED,
                    description="Auction start time arrived. Bidding is now open!",
                )
                session.add(log)

            if activated_rfqs:
                logger.info(f"🟢 Activated {len(activated_rfqs)} auction(s)")

            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Error in auction status scheduler: {e}")

