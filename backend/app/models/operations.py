"""Recorded operational milestones; these records do not execute bank transfers."""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (CheckConstraint, Date, DateTime, ForeignKey, Integer,
                        Numeric, String, Text, UniqueConstraint, func)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CompensationPayment(Base):
    __tablename__ = "compensation_payments"
    __table_args__ = (
        UniqueConstraint("project_id", "reference", name="uq_payment_reference"),
        CheckConstraint("amount > 0", name="ck_payment_amount_positive"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    award_id: Mapped[int] = mapped_column(ForeignKey("acquisition_awards.id"), index=True)
    reference: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProjectMilestone(Base):
    __tablename__ = "project_milestones"
    __table_args__ = (UniqueConstraint("project_id", "title", name="uq_milestone_title"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    completed_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[str] = mapped_column(String(80), nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RRProgressEvent(Base):
    __tablename__ = "rr_progress_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("rr_households.id"), index=True)
    previous_status: Mapped[str] = mapped_column(String(25), nullable=False)
    new_status: Mapped[str] = mapped_column(String(25), nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
