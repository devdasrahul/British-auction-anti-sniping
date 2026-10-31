import asyncio
import uuid
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.security import create_access_token
from app.models.user import User, UserRole
from app.models.rfq import RFQ, RFQStatus, RFQSupplier, InviteStatus
from app.models.auction_config import AuctionConfig, TriggerType
from app.models.bid import Bid
from app.models.activity_log import AuctionActivityLog, ActivityEventType
from app.api.deps import get_db, get_current_user


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def test_buyer_id():
    return uuid.UUID("11111111-1111-1111-1111-111111111111")


@pytest.fixture
def test_supplier1_id():
    return uuid.UUID("22222222-2222-2222-2222-222222222222")


@pytest.fixture
def test_supplier2_id():
    return uuid.UUID("33333333-3333-3333-3333-333333333333")


@pytest.fixture
def buyer_user(test_buyer_id) -> User:
    return User(
        id=test_buyer_id,
        name="Global Logistics Buyer",
        email="buyer@gocomet.com",
        role=UserRole.BUYER,
        password_hash="hashed_pw",
        created_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def supplier_user(test_supplier1_id) -> User:
    return User(
        id=test_supplier1_id,
        name="Maersk Carrier",
        email="carrier1@maersk.com",
        role=UserRole.SUPPLIER,
        password_hash="hashed_pw",
        created_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def buyer_token(test_buyer_id) -> str:
    return create_access_token(test_buyer_id)


@pytest.fixture
def supplier_token(test_supplier1_id) -> str:
    return create_access_token(test_supplier1_id)


@pytest.fixture
def buyer_headers(buyer_token) -> dict:
    return {"Authorization": f"Bearer {buyer_token}"}


@pytest.fixture
def supplier_headers(supplier_token) -> dict:
    return {"Authorization": f"Bearer {supplier_token}"}


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

