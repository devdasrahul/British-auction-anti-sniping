import uuid
import pytest
from httpx import AsyncClient
from app.main import app
from app.api.deps import get_current_user
from app.models.user import User, UserRole


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected(async_client: AsyncClient):
    """Endpoints requiring authentication return 401 Unauthorized without Bearer token."""
    response = await async_client.get("/api/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_supplier_cannot_create_rfq(async_client: AsyncClient, supplier_user: User):
    """Suppliers must receive HTTP 403 Forbidden when calling POST /rfqs."""
    # Override get_current_user to return supplier_user
    app.dependency_overrides[get_current_user] = lambda: supplier_user

    payload = {
        "name": "Supplier trying to create RFQ",
        "bid_start_time": "2026-11-01T10:00:00Z",
        "bid_close_time": "2026-11-01T16:00:00Z",
        "forced_close_time": "2026-11-01T18:00:00Z",
        "pickup_service_date": "2026-11-15",
        "is_british_auction": False,
    }

    try:
        response = await async_client.post("/rfqs", json=payload)
        assert response.status_code == 403
        assert "Access denied. Required role: BUYER" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_buyer_cannot_submit_bid(async_client: AsyncClient, buyer_user: User):
    """Buyers must receive HTTP 403 Forbidden when calling POST /rfqs/:id/bids."""
    app.dependency_overrides[get_current_user] = lambda: buyer_user
    fake_rfq_id = uuid.uuid4()

    payload = {
        "carrier_name": "Buyer Carrier",
        "freight_charges": 100000.00,
        "origin_charges": 5000.00,
        "destination_charges": 5000.00,
        "transit_time": "15 days",
        "quote_validity": "2026-11-30",
    }

    try:
        response = await async_client.post(f"/rfqs/{fake_rfq_id}/bids", json=payload)
        assert response.status_code == 403
        assert "Access denied. Required role: SUPPLIER" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_supplier_cannot_award_rfq(async_client: AsyncClient, supplier_user: User):
    """Suppliers must receive HTTP 403 Forbidden when attempting to award an RFQ."""
    app.dependency_overrides[get_current_user] = lambda: supplier_user
    fake_rfq_id = uuid.uuid4()
    fake_bid_id = uuid.uuid4()

    try:
        response = await async_client.post(
            f"/rfqs/{fake_rfq_id}/award", json={"bid_id": str(fake_bid_id)}
        )
        assert response.status_code == 403
        assert "Access denied. Required role: BUYER" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()

