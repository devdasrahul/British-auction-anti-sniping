import uuid
from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy import (
    String,
    DateTime,
    Date,
    Boolean,
    Numeric,
    Integer,
    ForeignKey,
    CheckConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Bid(Base):
    __tablename__ = "bids"

    __table_args__ = (
        CheckConstraint("freight_charges >= 0", name="chk_freight_positive"),
        CheckConstraint("origin_charges >= 0", name="chk_origin_positive"),
        CheckConstraint("destination_charges >= 0", name="chk_destination_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    rfq_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    carrier_name: Mapped[str] = mapped_column(String(255), nullable=False)
    freight_charges: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    origin_charges: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    destination_charges: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_charges: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, index=True)
    transit_time: Mapped[str] = mapped_column(String(100), nullable=False)
    quote_validity: Mapped[date] = mapped_column(Date, nullable=False)
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    rfq: Mapped["RFQ"] = relationship("RFQ", back_populates="bids", foreign_keys=[rfq_id])
    supplier: Mapped["User"] = relationship("User", back_populates="bids")
    activity_logs: Mapped[list["AuctionActivityLog"]] = relationship(
        "AuctionActivityLog", back_populates="triggered_by_bid"
    )

