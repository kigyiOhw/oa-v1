import logging
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import AttendanceRecord

logger = logging.getLogger(__name__)


class AttendanceRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_user_and_date(self, user_id: int, record_date: date) -> AttendanceRecord | None:
        result = await self.session.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.user_id == user_id,
                AttendanceRecord.record_date == record_date,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_user_monthly(
        self, user_id: int, year: int, month: int, page: int, page_size: int
    ) -> tuple[list[AttendanceRecord], int]:
        offset = (page - 1) * page_size
        base = select(AttendanceRecord).where(
            AttendanceRecord.user_id == user_id,
            func.extract("year", AttendanceRecord.record_date) == year,
            func.extract("month", AttendanceRecord.record_date) == month,
        )
        count_base = select(func.count(AttendanceRecord.id)).where(
            AttendanceRecord.user_id == user_id,
            func.extract("year", AttendanceRecord.record_date) == year,
            func.extract("month", AttendanceRecord.record_date) == month,
        )

        total = (await self.session.execute(count_base)).scalar() or 0
        result = await self.session.execute(
            base.order_by(AttendanceRecord.record_date.desc()).offset(offset).limit(page_size)
        )
        return list(result.scalars().all()), total

    async def get_monthly_status_counts(
        self, user_id: int, year: int, month: int
    ) -> dict[str, int]:
        """Get count of each status type for a user in a given month."""
        base = select(
            AttendanceRecord.status, func.count(AttendanceRecord.id)
        ).where(
            AttendanceRecord.user_id == user_id,
            func.extract("year", AttendanceRecord.record_date) == year,
            func.extract("month", AttendanceRecord.record_date) == month,
        ).group_by(AttendanceRecord.status)

        rows = (await self.session.execute(base)).all()
        return {row[0]: row[1] for row in rows}

    async def get_total_days_in_month(
        self, user_id: int, year: int, month: int
    ) -> int:
        """Get total attendance records (including leave) for a user in a month."""
        result = await self.session.execute(
            select(func.count(AttendanceRecord.id)).where(
                AttendanceRecord.user_id == user_id,
                func.extract("year", AttendanceRecord.record_date) == year,
                func.extract("month", AttendanceRecord.record_date) == month,
            )
        )
        return result.scalar() or 0

    async def get_users_monthly_summary(
        self, user_ids: list[int], year: int, month: int
    ) -> list[dict]:
        """Get status breakdown for a list of users in a given month."""
        if not user_ids:
            return []
        base = select(
            AttendanceRecord.user_id,
            AttendanceRecord.status,
            func.count(AttendanceRecord.id).label("cnt"),
        ).where(
            AttendanceRecord.user_id.in_(user_ids),
            func.extract("year", AttendanceRecord.record_date) == year,
            func.extract("month", AttendanceRecord.record_date) == month,
        ).group_by(AttendanceRecord.user_id, AttendanceRecord.status)

        rows = (await self.session.execute(base)).all()
        result: dict[int, dict[str, int]] = {uid: {} for uid in user_ids}
        for user_id, status, cnt in rows:
            result[user_id][status] = cnt
        return [{"user_id": uid, **counts} for uid, counts in result.items()]

    async def create(self, record: AttendanceRecord) -> AttendanceRecord:
        self.session.add(record)
        await self.session.flush()
        return record

    async def update(self, record: AttendanceRecord) -> AttendanceRecord:
        await self.session.flush()
        await self.session.refresh(record)
        return record

    async def delete(self, record: AttendanceRecord) -> None:
        await self.session.delete(record)
        await self.session.flush()
