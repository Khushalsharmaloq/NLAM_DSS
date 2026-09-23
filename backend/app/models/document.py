from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)

from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProjectDocument(Base):
    __tablename__ = "project_documents"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id"),
        nullable=False,
        index=True,
    )

    document_type: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    original_filename: Mapped[str] = mapped_column(
        String(180),
        nullable=False,
    )

    stored_filename: Mapped[str] = mapped_column(
        String(80),
        unique=True,
        nullable=False,
    )

    content_type: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
    )

    size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    uploaded_by_username: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
    )

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )