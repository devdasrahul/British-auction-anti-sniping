import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.rfq import RFQCreate, RFQListItem, RFQDetail, AwardRequest
from app.schemas.bid import BidCreate, BidRead
from app.schemas.user import UserRead
from app.crud.rfq import create_rfq, get_rfq_by_id, list_rfqs, award_rfq
from app.crud.bid import submit_quote, get_rfq_bids
from app.crud.user import list_suppliers
from app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/rfqs", tags=["RFQs"])


@router.post("", response_model=RFQDetail, status_code=status.HTTP_201_CREATED)
async def create_new_rfq(
    rfq_in: RFQCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.BUYER)),
):
    """
    POST /rfqs – Create RFQ (Buyer only)
    Validates:
    - forced_close_time > bid_close_time
    - bid_close_time > bid_start_time
    - If is_british_auction = true, validates X, Y, and trigger_type
    Inserts relationally into `rfqs` and `auction_configs` (1:1).
    """
    try:
        rfq = await create_rfq(
            session=db,
            rfq_in=rfq_in,
            creator_id=current_user.id,
            creator_name=current_user.name,
        )
        return RFQDetail.model_validate(rfq)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[RFQListItem])
async def list_auctions(
    status_filter: Optional[str] = Query("ALL", alias="status"),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    GET /rfqs – List all auctions
    Computes current lowest L1 price and filters by user role & status.
    """
    items = await list_rfqs(
        session=db,
        user_id=current_user.id,
        user_role=current_user.role.value,
        status_filter=status_filter,
        search=search,
    )
    return items


@router.get("/suppliers", response_model=List[UserRead])
async def get_available_suppliers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.BUYER)),
):
    """GET /rfqs/suppliers – List available carriers for invitations."""
    suppliers = await list_suppliers(db)
    return [UserRead.model_validate(s) for s in suppliers]


@router.get("/{id}", response_model=RFQDetail)
async def get_auction_details(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    GET /rfqs/{id} – Auction details
    Returns:
    - All active bids sorted by price/rank (L1 -> L2 -> L3...)
    - Full quote breakdowns (freight, origin, destination, transit time, validity)
    - British Auction config (X, Y, trigger condition)
    - Chronological activity log showing bids and extensions with reasons
    """
    rfq = await get_rfq_by_id(db, id)
    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="RFQ not found"
        )
    return RFQDetail.model_validate(rfq)


@router.post("/{id}/bids", status_code=status.HTTP_201_CREATED)
async def submit_bid_quote(
    id: uuid.UUID,
    bid_in: BidCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPPLIER)),
):
    """
    POST /rfqs/{id}/bids – Submit / re-bid (Supplier only)
    Triggers the British Auction Extension Engine:
    1. Records quote with auto-computed total charges.
    2. Enforces reverse auction rule: re-bidding must be strictly lower.
    3. Recomputes leaderboard ranks (L1, L2, L3...).
    4. Evaluates trigger window (now >= bid_close_time - X min) and trigger_type.
    5. Extends bid_close_time by Y minutes (strictly capped at forced_close_time).
    6. Logs TIME_EXTENDED in activity log.
    """
    try:
        new_bid, ranked_bids, ext_result = await submit_quote(
            session=db,
            rfq_id=id,
            supplier_id=current_user.id,
            supplier_name=current_user.name,
            bid_in=bid_in,
        )
        return {
            "bid": BidRead.model_validate(new_bid),
            "rankings": [BidRead.model_validate(b) for b in ranked_bids],
            "extension": ext_result.to_dict() if ext_result else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get("/{id}/bids", response_model=List[BidRead])
async def list_auction_bids(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """GET /rfqs/{id}/bids – Retrieve active quotes for RFQ."""
    bids = await get_rfq_bids(db, id)
    return [BidRead.model_validate(b) for b in bids]


@router.post("/{id}/award", response_model=RFQDetail)
async def award_rfq_contract(
    id: uuid.UUID,
    req: AwardRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.BUYER)),
):
    """POST /rfqs/{id}/award – Award contract to winning carrier."""
    try:
        rfq = await award_rfq(
            session=db, rfq_id=id, bid_id=req.bid_id, buyer_id=current_user.id
        )
        return RFQDetail.model_validate(rfq)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

