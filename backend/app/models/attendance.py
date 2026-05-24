from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    record_date: Mapped[date] = mapped_column(Date, nullable=False)
    check_in_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    check_out_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="normal", nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="check_in", nullable=False)
    leave_request_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("leave_requests.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    leave_request: Mapped["LeaveRequest | None"] = relationship(
        "LeaveRequest", foreign_keys=[leave_request_id]
    )

    __table_args__ = (
        UniqueConstraint("user_id", "record_date", name="uq_attendance_user_date"),
    )
