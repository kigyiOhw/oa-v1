from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class EmployeeProfileBase(BaseModel):
    phone: str | None = Field(None, max_length=20)
    address: str | None = None


class EmployeeProfileMyUpdate(EmployeeProfileBase):
    """Self-service: only phone and address can be edited."""
    pass


class OnboardingRequest(BaseModel):
    """Onboarding submission: all fields editable, locks identity fields after submit."""
    phone: str | None = Field(None, max_length=20)
    address: str | None = None
    birthday: date | None = None
    work_experience: str | None = None
    graduation_school: str | None = Field(None, max_length=200)
    education_level: str | None = Field(None, max_length=50)


class EmployeeProfileAdminUpdate(BaseModel):
    """Admin can edit all fields including identity and employment info."""
    phone: str | None = Field(None, max_length=20)
    address: str | None = None
    birthday: date | None = None
    work_experience: str | None = None
    graduation_school: str | None = Field(None, max_length=200)
    education_level: str | None = Field(None, max_length=50)
    join_date: date | None = None
    employment_status: str | None = Field(None, pattern=r"^(active|resigned)$")


class ResignRequest(BaseModel):
    successor_id: int
    resignation_date: date | None = None


class EmployeeProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    phone: str | None = None
    address: str | None = None
    birthday: date | None = None
    work_experience: str | None = None
    graduation_school: str | None = None
    education_level: str | None = None
    join_date: date | None = None
    employment_status: str
    resignation_date: date | None = None
    onboarding_complete: bool
    created_at: datetime
    updated_at: datetime
    # Embedded user info for convenience
    username: str = ""
    full_name: str | None = None
    department_name: str | None = None

    @classmethod
    def from_profile(cls, profile) -> "EmployeeProfileOut":
        user = profile.user
        return cls(
            id=profile.id,
            user_id=profile.user_id,
            phone=profile.phone,
            address=profile.address,
            birthday=profile.birthday,
            work_experience=profile.work_experience,
            graduation_school=profile.graduation_school,
            education_level=profile.education_level,
            join_date=profile.join_date,
            employment_status=profile.employment_status,
            resignation_date=profile.resignation_date,
            onboarding_complete=profile.onboarding_complete,
            created_at=profile.created_at,
            updated_at=profile.updated_at,
            username=user.username if user else "",
            full_name=user.full_name if user else None,
            department_name=user.department.name if user and user.department else None,
        )


class PaginatedEmployees(BaseModel):
    items: list[EmployeeProfileOut]
    total: int
    page: int
    page_size: int
