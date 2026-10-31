import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Integer, DateTime, Enum, ForeignKey, CheckConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class TriggerType(str, enum.Enum):
    BID_RECEIVED = "BID_RECEIVED"
    ANY_RANK_CHANGE = "ANY_RANK_CHANGE"
    L1_RANK_CHANGE = "L1_RANK_CHANGE"


class AuctionConfig(Base):
    __tablename__ = "auction_configs"

    __table_args__ = (
        CheckConstraint("trigger_window_minutes > 0", name="chk_trigger_window_positive"),
        CheckConstraint("extension_duration_minutes > 0", name="chk_extension_duration_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    rfq_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("rfqs.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    trigger_window_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    extension_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    trigger_type: Mapped[TriggerType] = mapped_column(
        Enum(TriggerType, name="trigger_type"),
        default=TriggerType.BID_RECEIVED,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationship back to RFQ (One-to-One)
    rfq: Mapped["RFQ"] = relationship("RFQ", back_populates="auction_config")

