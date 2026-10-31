import pytest
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from app.models.rfq import RFQ, RFQStatus
from app.models.auction_config import AuctionConfig, TriggerType
from app.models.bid import Bid
from app.services.auction_engine import evaluate_british_auction_extension


@pytest.mark.asyncio
async def test_extension_triggers_when_in_window_and_l1_changes():
    """Test that a new L1 bidder within trigger window X extends the close time by Y."""
    now = datetime.now(timezone.utc)
    close_time = now + timedelta(minutes=5)       # In 5 minutes
    forced_time = now + timedelta(minutes=30)     # In 30 minutes

    rfq = RFQ(
        id=uuid.uuid4(),
        name="Test RFQ",
        reference_id="TEST-001",
        created_by=uuid.uuid4(),
        bid_start_time=now - timedelta(hours=1),
        bid_close_time=close_time,
        forced_close_time=forced_time,
        pickup_service_date=now.date(),
        is_british_auction=True,
        status=RFQStatus.ACTIVE,
    )

    config = AuctionConfig(
        rfq_id=rfq.id,
        trigger_window_minutes=10,      # Trigger window is 10 min (we are at 5 min -> INSIDE window)
        extension_duration_minutes=5,   # Extend by 5 min
        trigger_type=TriggerType.L1_RANK_CHANGE,
    )
    rfq.auction_config = config

    new_bid = Bid(
        id=uuid.uuid4(),
        rfq_id=rfq.id,
        supplier_id=uuid.uuid4(),
        carrier_name="FedEx",
        freight_charges=Decimal("38000.00"),
        origin_charges=Decimal("2000.00"),
        destination_charges=Decimal("2000.00"),
        total_charges=Decimal("42000.00"),
        transit_time="2 days",
        quote_validity=now.date(),
        rank=1,
        is_active=True,
    )

    mock_session = AsyncMock()

    result = await evaluate_british_auction_extension(
        session=mock_session,
        rfq=rfq,
        new_bid=new_bid,
        is_l1_change=True,
        is_any_rank_change=True,
        supplier_name="FedEx",
    )

    assert result is not None
    assert result.extended is True
    assert result.extension_minutes == 5
    # The new close time should be close_time + 5 minutes
    expected_new_close = close_time + timedelta(minutes=5)
    assert rfq.bid_close_time == expected_new_close


@pytest.mark.asyncio
async def test_extension_capped_at_forced_close_time():
    """Test that extension never exceeds forced_close_time (Hard Cap)."""
    now = datetime.now(timezone.utc)
    close_time = now + timedelta(minutes=2)       # In 2 minutes
    forced_time = now + timedelta(minutes=4)      # Hard cap is only 4 minutes away

    rfq = RFQ(
        id=uuid.uuid4(),
        name="Test RFQ Hard Cap",
        reference_id="TEST-002",
        created_by=uuid.uuid4(),
        bid_start_time=now - timedelta(hours=1),
        bid_close_time=close_time,
        forced_close_time=forced_time,
        pickup_service_date=now.date(),
        is_british_auction=True,
        status=RFQStatus.ACTIVE,
    )

    config = AuctionConfig(
        rfq_id=rfq.id,
        trigger_window_minutes=10,
        extension_duration_minutes=5,     # 2 min + 5 min = 7 min -> EXCEEDS 4 min forced close!
        trigger_type=TriggerType.BID_RECEIVED,
    )
    rfq.auction_config = config

    new_bid = Bid(
        id=uuid.uuid4(),
        rfq_id=rfq.id,
        supplier_id=uuid.uuid4(),
        carrier_name="DHL",
        freight_charges=Decimal("40000.00"),
        origin_charges=Decimal("0.00"),
        destination_charges=Decimal("0.00"),
        total_charges=Decimal("40000.00"),
        transit_time="3 days",
        quote_validity=now.date(),
        rank=1,
        is_active=True,
    )

    mock_session = AsyncMock()

    result = await evaluate_british_auction_extension(
        session=mock_session,
        rfq=rfq,
        new_bid=new_bid,
        is_l1_change=True,
        is_any_rank_change=True,
        supplier_name="DHL",
    )

    assert result is not None
    assert result.extended is True
    # The new close time should be clamped strictly to forced_close_time
    assert rfq.bid_close_time == forced_time


@pytest.mark.asyncio
async def test_no_extension_outside_trigger_window():
    """Test that bids placed before the trigger window do not cause an extension."""
    now = datetime.now(timezone.utc)
    close_time = now + timedelta(minutes=30)     # 30 min away
    forced_time = now + timedelta(hours=2)

    rfq = RFQ(
        id=uuid.uuid4(),
        name="Test RFQ Outside Window",
        reference_id="TEST-003",
        created_by=uuid.uuid4(),
        bid_start_time=now - timedelta(hours=1),
        bid_close_time=close_time,
        forced_close_time=forced_time,
        pickup_service_date=now.date(),
        is_british_auction=True,
        status=RFQStatus.ACTIVE,
    )

    config = AuctionConfig(
        rfq_id=rfq.id,
        trigger_window_minutes=10,     # Trigger window starts at 20 min from now
        extension_duration_minutes=5,
        trigger_type=TriggerType.BID_RECEIVED,
    )
    rfq.auction_config = config

    new_bid = Bid(
        id=uuid.uuid4(),
        rfq_id=rfq.id,
        supplier_id=uuid.uuid4(),
        carrier_name="FedEx",
        freight_charges=Decimal("50000.00"),
        origin_charges=Decimal("0.00"),
        destination_charges=Decimal("0.00"),
        total_charges=Decimal("50000.00"),
        transit_time="3 days",
        quote_validity=now.date(),
        rank=1,
        is_active=True,
    )

    mock_session = AsyncMock()

    result = await evaluate_british_auction_extension(
        session=mock_session,
        rfq=rfq,
        new_bid=new_bid,
        is_l1_change=True,
        is_any_rank_change=True,
        supplier_name="FedEx",
    )

    # Should NOT extend
    assert result is None
    assert rfq.bid_close_time == close_time

