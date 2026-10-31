import uuid
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


class BidBase(BaseModel):
    carrier_name: str
    freight_charges: Decimal = Field(..., ge=0)
    origin_charges: Decimal = Field(default=Decimal("0.00"), ge=0)
    destination_charges: Decimal = Field(default=Decimal("0.00"), ge=0)
    transit_time: str
    quote_validity: date


class BidCreate(BidBase):
    pass


class SupplierMinimal(BaseModel):
    id: uuid.UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


class BidRead(BidBase):
    id: uuid.UUID
    rfq_id: uuid.UUID
    supplier_id: uuid.UUID
    total_charges: Decimal
    rank: Optional[int] = None
    is_active: bool
    submitted_at: datetime
    supplier: Optional[SupplierMinimal] = None

    model_config = ConfigDict(from_attributes=True)

