import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Enum, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class ActivityEventType(str, enum.Enum):
    RFQ_CREATED = "RFQ_CREATED"
    AUCTION_STARTED = "AUCTION_STARTED"
    BID_SUBMITTED = "BID_SUBMITTED"
    TIME_EXTENDED = "TIME_EXTENDED"
    AUCTION_CLOSED = "AUCTION_CLOSED"
    FORCE_CLOSED = "FORCE_CLOSED"
    QUOTE_AWARDED = "QUOTE_AWARDED"


class AuctionActivityLog(Base):
    __tablename__ = "auction_activity_log"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    rfq_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[ActivityEventType] = mapped_column(
        Enum(ActivityEventType, name="activity_event_type"), nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    triggered_by_bid_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("bids.id", ondelete="SET NULL"), nullable=True
    )
    previous_close_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    new_close_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )

    # Relationships
    rfq: Mapped["RFQ"] = relationship("RFQ", back_populates="activity_logs")
    triggered_by_bid: Mapped["Bid"] = relationship("Bid", back_populates="activity_logs")

