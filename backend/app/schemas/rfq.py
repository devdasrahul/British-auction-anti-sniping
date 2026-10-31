import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, model_validator, ConfigDict
from app.models.rfq import RFQStatus
from app.schemas.auction_config import AuctionConfigBase, AuctionConfigRead
from app.schemas.bid import BidRead
from app.schemas.activity_log import ActivityLogRead
from app.schemas.user import UserRead


class RFQBase(BaseModel):
    name: str
    bid_start_time: datetime
    bid_close_time: datetime
    forced_close_time: datetime
    pickup_service_date: date
    is_british_auction: bool = False


class RFQCreate(RFQBase):
    supplier_ids: List[uuid.UUID] = Field(default_factory=list)
    auction_config: Optional[AuctionConfigBase] = None

    @model_validator(mode="after")
    def validate_rfq_business_rules(self) -> "RFQCreate":
        if self.bid_close_time <= self.bid_start_time:
            raise ValueError("bid_close_time must be strictly later than bid_start_time")
        if self.forced_close_time <= self.bid_close_time:
            raise ValueError("Validation Rule: forced_close_time must always be greater than bid_close_time")
        if self.is_british_auction and not self.auction_config:
            raise ValueError("auction_config is required when is_british_auction is true")
        return self


class RFQListItem(BaseModel):
    id: uuid.UUID
    name: str
    reference_id: str
    status: RFQStatus
    bid_start_time: datetime
    bid_close_time: datetime
    forced_close_time: datetime
    pickup_service_date: date
    is_british_auction: bool
    current_lowest_bid: Optional[Decimal] = None
    active_bid_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RFQDetail(BaseModel):
    id: uuid.UUID
    name: str
    reference_id: str
    status: RFQStatus
    bid_start_time: datetime
    bid_close_time: datetime
    forced_close_time: datetime
    pickup_service_date: date
    is_british_auction: bool
    status: RFQStatus
    awarded_bid_id: Optional[uuid.UUID] = None
    created_by: uuid.UUID
    creator: Optional[UserRead] = None
    auction_config: Optional[AuctionConfigRead] = None
    bids: List[BidRead] = Field(default_factory=list)
    activity_logs: List[ActivityLogRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AwardRequest(BaseModel):
    bid_id: uuid.UUID

