import enum
import uuid
from datetime import datetime, date, timezone
from sqlalchemy import (
    String,
    DateTime,
    Date,
    Boolean,
    Enum,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class RFQStatus(str, enum.Enum):
    UPCOMING = "UPCOMING"
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"
    FORCE_CLOSED = "FORCE_CLOSED"
    AWARDED = "AWARDED"


class InviteStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"


class RFQ(Base):
    __tablename__ = "rfqs"

    __table_args__ = (
        CheckConstraint("forced_close_time > bid_close_time", name="chk_forced_after_close"),
        CheckConstraint("bid_close_time > bid_start_time", name="chk_close_after_start"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    reference_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    bid_start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    bid_close_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    forced_close_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    pickup_service_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_british_auction: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[RFQStatus] = mapped_column(
        Enum(RFQStatus, name="rfq_status"), default=RFQStatus.UPCOMING, nullable=False, index=True
    )
    awarded_bid_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("bids.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    creator: Mapped["User"] = relationship("User", back_populates="rfqs", foreign_keys=[created_by])
    auction_config: Mapped["AuctionConfig"] = relationship(
        "AuctionConfig", back_populates="rfq", uselist=False, cascade="all, delete-orphan"
    )
    bids: Mapped[list["Bid"]] = relationship(
        "Bid",
        back_populates="rfq",
        cascade="all, delete-orphan",
        foreign_keys="Bid.rfq_id",
        order_by="Bid.rank.asc()",
    )
    awarded_bid: Mapped["Bid"] = relationship("Bid", foreign_keys=[awarded_bid_id])
    suppliers: Mapped[list["RFQSupplier"]] = relationship(
        "RFQSupplier", back_populates="rfq", cascade="all, delete-orphan"
    )
    activity_logs: Mapped[list["AuctionActivityLog"]] = relationship(
        "AuctionActivityLog",
        back_populates="rfq",
        cascade="all, delete-orphan",
        order_by="AuctionActivityLog.created_at.desc()",
    )


class RFQSupplier(Base):
    __tablename__ = "rfq_suppliers"

    __table_args__ = (
        UniqueConstraint("rfq_id", "supplier_id", name="uq_rfq_supplier"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    rfq_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    invite_status: Mapped[InviteStatus] = mapped_column(
        Enum(InviteStatus, name="invite_status"), default=InviteStatus.PENDING, nullable=False
    )
    invited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    rfq: Mapped["RFQ"] = relationship("RFQ", back_populates="suppliers")
    supplier: Mapped["User"] = relationship("User", back_populates="invited_rfqs")

