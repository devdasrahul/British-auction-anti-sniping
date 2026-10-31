from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.rfq import RFQ
from app.models.auction_config import AuctionConfig, TriggerType
from app.models.bid import Bid
from app.models.activity_log import AuctionActivityLog, ActivityEventType


class ExtensionResult:
    def __init__(
        self,
        extended: bool,
        previous_close_time: Optional[datetime] = None,
        new_close_time: Optional[datetime] = None,
        extension_minutes: int = 0,
        reason: str = "",
    ):
        self.extended = extended
        self.previous_close_time = previous_close_time
        self.new_close_time = new_close_time
        self.extension_minutes = extension_minutes
        self.reason = reason

    def to_dict(self) -> Dict[str, Any]:
        return {
            "extended": self.extended,
            "previous_close_time": self.previous_close_time.isoformat() if self.previous_close_time else None,
            "new_close_time": self.new_close_time.isoformat() if self.new_close_time else None,
            "extension_minutes": self.extension_minutes,
            "reason": self.reason,
        }


async def evaluate_british_auction_extension(
    session: AsyncSession,
    rfq: RFQ,
    new_bid: Bid,
    is_l1_change: bool,
    is_any_rank_change: bool,
    supplier_name: str,
) -> Optional[ExtensionResult]:
    """
    British Auction Extension Engine:
    
    1. If is_british_auction = False -> STOP
    2. If now < bid_close_time - X minutes -> STOP
    3. Check trigger_type:
       - BID_RECEIVED -> always extend
       - ANY_RANK_CHANGE -> extend only if any rank changed
       - L1_RANK_CHANGE -> extend only if lowest bidder (L1) changed
    4. If condition met:
       new_close_time = min(bid_close_time + Y minutes, forced_close_time)
       Update rfqs.bid_close_time
       Log TIME_EXTENDED in auction_activity_log
    5. Auction MUST close at forced_close_time no matter what
    """
    # 1. Verify British Auction is enabled
    if not rfq.is_british_auction or not rfq.auction_config:
        return None

    config: AuctionConfig = rfq.auction_config
    now = datetime.now(timezone.utc)

    # Ensure rfq datetimes are timezone-aware in UTC
    current_close = rfq.bid_close_time
    if current_close.tzinfo is None:
        current_close = current_close.replace(tzinfo=timezone.utc)

    forced_close = rfq.forced_close_time
    if forced_close.tzinfo is None:
        forced_close = forced_close.replace(tzinfo=timezone.utc)

    # 2. Trigger Window Check: (now >= bid_close_time - X minutes)
    trigger_window_delta = timedelta(minutes=config.trigger_window_minutes)
    trigger_window_start = current_close - trigger_window_delta

    if now < trigger_window_start:
        # Quote arrived before the trigger window; no extension
        return None

    # 3. Check Trigger Condition
    should_extend = False
    trigger_reason = ""

    if config.trigger_type == TriggerType.BID_RECEIVED:
        should_extend = True
        trigger_reason = f"Bid submitted by {supplier_name} in the final {config.trigger_window_minutes} minutes"

    elif config.trigger_type == TriggerType.ANY_RANK_CHANGE:
        should_extend = is_any_rank_change
        trigger_reason = (
            f"Supplier rankings shifted (new rank L{new_bid.rank}) in the final {config.trigger_window_minutes} minutes"
        )

    elif config.trigger_type == TriggerType.L1_RANK_CHANGE:
        should_extend = is_l1_change
        trigger_reason = (
            f"New lowest bidder (L1) achieved by {supplier_name} in the final {config.trigger_window_minutes} minutes"
        )

    if not should_extend:
        return None

    # 4. Calculate proposed close time: current close + Y minutes
    extension_delta = timedelta(minutes=config.extension_duration_minutes)
    proposed_close = current_close + extension_delta

    # Hard Cap Rule: new_close_time = min(proposed_close, forced_close_time)
    new_close_time = min(proposed_close, forced_close)

    # If already at or beyond forced close time, no further extension is possible
    if new_close_time <= current_close:
        return None

    # Calculate actual minutes added
    actual_extension_minutes = int((new_close_time - current_close).total_seconds() // 60)

    previous_close_time = current_close

    # 5. Update RFQ rolling close time
    rfq.bid_close_time = new_close_time
    session.add(rfq)

    # 6. Log TIME_EXTENDED event in auction_activity_log
    log_entry = AuctionActivityLog(
        rfq_id=rfq.id,
        event_type=ActivityEventType.TIME_EXTENDED,
        description=f"Auction extended by {actual_extension_minutes} min. Reason: {trigger_reason}",
        triggered_by_bid_id=new_bid.id,
        previous_close_time=previous_close_time,
        new_close_time=new_close_time,
    )
    session.add(log_entry)
    await session.flush()

    return ExtensionResult(
        extended=True,
        previous_close_time=previous_close_time,
        new_close_time=new_close_time,
        extension_minutes=actual_extension_minutes,
        reason=trigger_reason,
    )

