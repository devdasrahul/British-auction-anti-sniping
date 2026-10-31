import uuid
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from app.models.auction_config import TriggerType


class AuctionConfigBase(BaseModel):
    trigger_window_minutes: int = Field(..., gt=0, description="X minutes before close")
    extension_duration_minutes: int = Field(..., gt=0, description="Y minutes added on trigger")
    trigger_type: TriggerType = TriggerType.BID_RECEIVED


class AuctionConfigCreate(AuctionConfigBase):
    pass


class AuctionConfigRead(AuctionConfigBase):
    id: uuid.UUID
    rfq_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

