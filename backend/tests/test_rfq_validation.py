import uuid
from datetime import datetime, date, timedelta, timezone
import pytest
from pydantic import ValidationError
from app.schemas.rfq import RFQCreate
from app.schemas.auction_config import AuctionConfigBase
from app.models.auction_config import TriggerType
from app.models.rfq import RFQ, RFQStatus
from app.models.user import UserRole
from app.services.scheduler_service import update_auction_statuses
from unittest.mock import AsyncMock, patch


def test_rfq_validation_fails_when_forced_close_is_not_after_bid_close():
    """Verify that forced_close_time <= bid_close_time raises validation error."""
    now = datetime.now(timezone.utc)
    start = now
    close = now + timedelta(hours=2)
    # Invalid: forced close is BEFORE bid close
    forced = now + timedelta(hours=1)

    with pytest.raises(ValidationError) as exc_info:
        RFQCreate(
            name="Invalid RFQ Times",
            bid_start_time=start,
            bid_close_time=close,
            forced_close_time=forced,
            pickup_service_date=date.today(),
            is_british_auction=False,
        )

    assert "forced_close_time must always be greater than bid_close_time" in str(exc_info.value)


def test_rfq_validation_fails_when_close_is_before_start():
    """Verify that bid_close_time <= bid_start_time raises validation error."""
    now = datetime.now(timezone.utc)
    start = now + timedelta(hours=2)
    close = now + timedelta(hours=1)
    forced = now + timedelta(hours=3)

    with pytest.raises(ValidationError) as exc_info:
        RFQCreate(
            name="Invalid RFQ Times",
            bid_start_time=start,
            bid_close_time=close,
            forced_close_time=forced,
            pickup_service_date=date.today(),
            is_british_auction=False,
        )

    assert "bid_close_time must be strictly later than bid_start_time" in str(exc_info.value)


def test_rfq_validation_fails_when_british_auction_missing_config():
    """Verify that is_british_auction=True requires auction_config."""
    now = datetime.now(timezone.utc)
    start = now
    close = now + timedelta(hours=2)
    forced = now + timedelta(hours=4)

    with pytest.raises(ValidationError) as exc_info:
        RFQCreate(
            name="British Auction without config",
            bid_start_time=start,
            bid_close_time=close,
            forced_close_time=forced,
            pickup_service_date=date.today(),
            is_british_auction=True,
            auction_config=None,
        )

    assert "auction_config is required when is_british_auction is true" in str(exc_info.value)


def test_rfq_validation_succeeds_with_valid_british_config():
    """Verify that valid parameters pass schema validation."""
    now = datetime.now(timezone.utc)
    start = now
    close = now + timedelta(hours=2)
    forced = now + timedelta(hours=4)

    payload = RFQCreate(
        name="Valid British Auction RFQ",
        bid_start_time=start,
        bid_close_time=close,
        forced_close_time=forced,
        pickup_service_date=date.today(),
        is_british_auction=True,
        auction_config=AuctionConfigBase(
            trigger_window_minutes=10,
            extension_duration_minutes=5,
            trigger_type=TriggerType.L1_RANK_CHANGE,
        ),
    )

    assert payload.name == "Valid British Auction RFQ"
    assert payload.is_british_auction is True
    assert payload.auction_config.trigger_window_minutes == 10

