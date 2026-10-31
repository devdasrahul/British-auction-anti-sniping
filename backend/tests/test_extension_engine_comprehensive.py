import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from unittest.mock import AsyncMock

from app.models.rfq import RFQ, RFQStatus
from app.models.auction_config import AuctionConfig, TriggerType
from app.models.bid import Bid
from app.models.activity_log import AuctionActivityLog, ActivityEventType
from app.services.auction_engine import evaluate_british_auction_extension
from app.services.ranking_service import recompute_ranks


@pytest.fixture
def base_rfq():
    now = datetime.now(timezone.utc)
    rfq = RFQ(
        id=uuid.uuid4(),
        name="Transatlantic Freight RFQ",
        reference_id="RFQ-TEST-ENG-01",
        created_by=uuid.uuid4(),
        bid_start_time=now - timedelta(hours=2),
        bid_close_time=now + timedelta(minutes=5),       # 5 minutes remaining
        forced_close_time=now + timedelta(minutes=30),   # 30 minutes hard deadline
        pickup_service_date=now.date(),
        is_british_auction=True,
        status=RFQStatus.ACTIVE,
    )
    return rfq


@pytest.fixture
def sample_bid(base_rfq):
    return Bid(
        id=uuid.uuid4(),
        rfq_id=base_rfq.id,
        supplier_id=uuid.uuid4(),
        carrier_name="Maersk Line",
        freight_charges=Decimal("120000.00"),
        origin_charges=Decimal("10000.00"),
        destination_charges=Decimal("15000.00"),
        total_charges=Decimal("145000.00"),
        transit_time="24 days",
        quote_validity=datetime.now(timezone.utc).date(),
        rank=1,
        is_active=True,
    )


@pytest.mark.asyncio
async def test_extension_outside_trigger_window_does_not_extend(base_rfq, sample_bid):
    """Rule: If now < bid_close_time - X minutes -> STOP (No extension)."""
    now = datetime.now(timezone.utc)
    # Set close time far in future (30 min away) with trigger window X = 10 min
    base_rfq.bid_close_time = now + timedelta(minutes=30)
    base_rfq.auction_config = AuctionConfig(
        rfq_id=base_rfq.id,
        trigger_window_minutes=10,
        extension_duration_minutes=5,
        trigger_type=TriggerType.BID_RECEIVED,
    )

    mock_session = AsyncMock()
    result = await evaluate_british_auction_extension(
        session=mock_session,
        rfq=base_rfq,
        new_bid=sample_bid,
        is_l1_change=True,
        is_any_rank_change=True,
        supplier_name="Maersk Line",
    )

    assert result is None
    assert mock_session.add.call_count == 0


@pytest.mark.asyncio
async def test_extension_trigger_bid_received_always_extends(base_rfq, sample_bid):
    """Rule: BID_RECEIVED trigger extends whenever a bid is received in the window."""
    now = datetime.now(timezone.utc)
    initial_close = now + timedelta(minutes=4)  # Inside 10 min window
    base_rfq.bid_close_time = initial_close
    base_rfq.auction_config = AuctionConfig(
        rfq_id=base_rfq.id,
        trigger_window_minutes=10,
        extension_duration_minutes=5,
        trigger_type=TriggerType.BID_RECEIVED,
    )

    mock_session = AsyncMock()
    result = await evaluate_british_auction_extension(
        session=mock_session,
        rfq=base_rfq,
        new_bid=sample_bid,
        is_l1_change=False,          # Even if ranks didn't change
        is_any_rank_change=False,
        supplier_name="Maersk Line",
    )

    assert result is not None
    assert result.extended is True
    assert result.extension_minutes == 5
    assert base_rfq.bid_close_time == initial_close + timedelta(minutes=5)
    # Verify activity log entry was created
    assert mock_session.add.call_count == 2  # 1 for rfq, 1 for activity log


@pytest.mark.asyncio
async def test_extension_trigger_any_rank_change(base_rfq, sample_bid):
    """Rule: ANY_RANK_CHANGE extends only if any rank changed; otherwise stops."""
    now = datetime.now(timezone.utc)
    initial_close = now + timedelta(minutes=4)
    base_rfq.bid_close_time = initial_close
    base_rfq.auction_config = AuctionConfig(
        rfq_id=base_rfq.id,
        trigger_window_minutes=10,
        extension_duration_minutes=5,
        trigger_type=TriggerType.ANY_RANK_CHANGE,
    )

    mock_session = AsyncMock()

    # Case A: Rank did NOT change -> No extension
    res_no_change = await evaluate_british_auction_extension(
        session=mock_session,
        rfq=base_rfq,
        new_bid=sample_bid,
        is_l1_change=False,
        is_any_rank_change=False,
        supplier_name="Maersk Line",
    )
    assert res_no_change is None

    # Case B: Rank DID change -> Extends
    res_change = await evaluate_british_auction_extension(
        session=mock_session,
        rfq=base_rfq,
        new_bid=sample_bid,
        is_l1_change=False,
        is_any_rank_change=True,
        supplier_name="Maersk Line",
    )
    assert res_change is not None
    assert res_change.extended is True


@pytest.mark.asyncio
async def test_extension_trigger_l1_rank_change(base_rfq, sample_bid):
    """Rule: L1_RANK_CHANGE extends only when lowest bidder changes."""
    now = datetime.now(timezone.utc)
    initial_close = now + timedelta(minutes=4)
    base_rfq.bid_close_time = initial_close
    base_rfq.auction_config = AuctionConfig(
        rfq_id=base_rfq.id,
        trigger_window_minutes=10,
        extension_duration_minutes=5,
        trigger_type=TriggerType.L1_RANK_CHANGE,
    )

    mock_session = AsyncMock()

    # Case A: L1 did NOT change (e.g. L2 overtook L3) -> No extension
    res_no_l1 = await evaluate_british_auction_extension(
        session=mock_session,
        rfq=base_rfq,
        new_bid=sample_bid,
        is_l1_change=False,
        is_any_rank_change=True,
        supplier_name="Maersk Line",
    )
    assert res_no_l1 is None

    # Case B: New L1 bidder appeared -> Extends
    res_l1 = await evaluate_british_auction_extension(
        session=mock_session,
        rfq=base_rfq,
        new_bid=sample_bid,
        is_l1_change=True,
        is_any_rank_change=True,
        supplier_name="Maersk Line",
    )
    assert res_l1 is not None
    assert res_l1.extended is True
    assert "New lowest bidder (L1)" in res_l1.reason


@pytest.mark.asyncio
async def test_extension_never_exceeds_forced_close_time(base_rfq, sample_bid):
    """Rule: new_close_time = min(bid_close_time + Y minutes, forced_close_time)."""
    now = datetime.now(timezone.utc)
    # Current close in 2 min, forced close in 4 min. Extension Y = 5 min
    base_rfq.bid_close_time = now + timedelta(minutes=2)
    base_rfq.forced_close_time = now + timedelta(minutes=4)
    base_rfq.auction_config = AuctionConfig(
        rfq_id=base_rfq.id,
        trigger_window_minutes=10,
        extension_duration_minutes=5,
        trigger_type=TriggerType.BID_RECEIVED,
    )

    mock_session = AsyncMock()
    result = await evaluate_british_auction_extension(
        session=mock_session,
        rfq=base_rfq,
        new_bid=sample_bid,
        is_l1_change=True,
        is_any_rank_change=True,
        supplier_name="Maersk Line",
    )

    assert result is not None
    assert result.extended is True
    # Clamped to forced_close_time (2 minutes added, NOT 5)
    assert base_rfq.bid_close_time == base_rfq.forced_close_time
    assert result.extension_minutes == 2


@pytest.mark.asyncio
async def test_extension_halts_when_already_at_forced_close(base_rfq, sample_bid):
    """Rule: When already capped at forced_close_time, no further extension is allowed."""
    now = datetime.now(timezone.utc)
    base_rfq.bid_close_time = now + timedelta(minutes=2)
    base_rfq.forced_close_time = now + timedelta(minutes=2)  # Already equal
    base_rfq.auction_config = AuctionConfig(
        rfq_id=base_rfq.id,
        trigger_window_minutes=10,
        extension_duration_minutes=5,
        trigger_type=TriggerType.BID_RECEIVED,
    )

    mock_session = AsyncMock()
    result = await evaluate_british_auction_extension(
        session=mock_session,
        rfq=base_rfq,
        new_bid=sample_bid,
        is_l1_change=True,
        is_any_rank_change=True,
        supplier_name="Maersk Line",
    )

    assert result is None


@pytest.mark.asyncio
async def test_activity_log_written_with_correct_metadata(base_rfq, sample_bid):
    """Rule: On extension, log TIME_EXTENDED event with previous and new close times."""
    now = datetime.now(timezone.utc)
    prev_close = now + timedelta(minutes=3)
    base_rfq.bid_close_time = prev_close
    base_rfq.auction_config = AuctionConfig(
        rfq_id=base_rfq.id,
        trigger_window_minutes=10,
        extension_duration_minutes=5,
        trigger_type=TriggerType.BID_RECEIVED,
    )

    mock_session = AsyncMock()
    result = await evaluate_british_auction_extension(
        session=mock_session,
        rfq=base_rfq,
        new_bid=sample_bid,
        is_l1_change=True,
        is_any_rank_change=True,
        supplier_name="Maersk Line",
    )

    assert result is not None
    # Inspect arguments passed to session.add
    added_objects = [call[0][0] for call in mock_session.add.call_args_list]
    log_entry = next((obj for obj in added_objects if isinstance(obj, AuctionActivityLog)), None)

    assert log_entry is not None
    assert log_entry.event_type == ActivityEventType.TIME_EXTENDED
    assert log_entry.triggered_by_bid_id == sample_bid.id
    assert log_entry.previous_close_time == prev_close
    assert log_entry.new_close_time == prev_close + timedelta(minutes=5)

