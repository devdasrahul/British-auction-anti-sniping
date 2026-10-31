import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.activity_log import ActivityEventType


class ActivityLogRead(BaseModel):
    id: uuid.UUID
    rfq_id: uuid.UUID
    event_type: ActivityEventType
    description: str
    triggered_by_bid_id: Optional[uuid.UUID] = None
    previous_close_time: Optional[datetime] = None
    new_close_time: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

