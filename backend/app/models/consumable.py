from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Consumable(Base):
    __tablename__ = "consumables"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("asset_categories.id"), nullable=False
    )
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    current_stock: Mapped[Decimal] = mapped_column(Numeric(10, 1), default=0)
    safety_stock: Mapped[Decimal] = mapped_column(Numeric(10, 1), default=0)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    category: Mapped["AssetCategory"] = relationship("AssetCategory")
    records: Mapped[list["ConsumableRecord"]] = relationship(
        "ConsumableRecord", back_populates="consumable", order_by="ConsumableRecord.created_at.desc()"
    )


class ConsumableRecord(Base):
    __tablename__ = "consumable_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    consumable_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("consumables.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(5), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 1), nullable=False)
    operator_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    record_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    consumable: Mapped["Consumable"] = relationship("Consumable", back_populates="records")
    operator: Mapped["User"] = relationship("User")
