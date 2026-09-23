"""Demonstration acquisition notification and award records (not legal instruments)."""
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class AcquisitionNotification(Base):
    __tablename__ = 'acquisition_notifications'
    __table_args__ = (
        UniqueConstraint('project_id', 'reference', name='uq_notification_project_reference'),
        CheckConstraint("status IN ('DRAFT', 'RECORDED')", name='ck_notification_status'),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey('projects.id'), nullable=False, index=True)
    reference: Mapped[str] = mapped_column(String(100), nullable=False)
    notification_type: Mapped[str] = mapped_column(String(100), nullable=False)
    legal_framework: Mapped[str] = mapped_column(String(200), nullable=False)
    notification_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default='DRAFT')
    notes: Mapped[str | None] = mapped_column(Text)
    actor_reference: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class NotificationParcel(Base):
    __tablename__ = 'notification_parcels'
    __table_args__ = (UniqueConstraint('notification_id', 'parcel_id', name='uq_notification_parcel'),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    notification_id: Mapped[int] = mapped_column(ForeignKey('acquisition_notifications.id'), nullable=False, index=True)
    parcel_id: Mapped[int] = mapped_column(ForeignKey('land_parcels.id'), nullable=False, index=True)


class AcquisitionAward(Base):
    __tablename__ = 'acquisition_awards'
    __table_args__ = (
        UniqueConstraint('project_id', 'reference', name='uq_award_project_reference'),
        CheckConstraint('amount >= 0', name='ck_award_nonnegative_amount'),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey('projects.id'), nullable=False, index=True)
    notification_id: Mapped[int] = mapped_column(ForeignKey('acquisition_notifications.id'), nullable=False, index=True)
    parcel_id: Mapped[int] = mapped_column(ForeignKey('land_parcels.id'), nullable=False, index=True)
    reference: Mapped[str] = mapped_column(String(100), nullable=False)
    award_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    actor_reference: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
