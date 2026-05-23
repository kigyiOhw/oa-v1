from pydantic import BaseModel, ConfigDict, Field


class RoleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: str | None = Field(None, max_length=200)
    role_type: str = Field(default="user", pattern=r"^(super_admin|module_admin|dept_admin|user)$")
    admin_scope: str | None = Field(default=None, pattern=r"^(global|department)$")


class RoleUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50)
    description: str | None = None
    role_type: str | None = Field(None, pattern=r"^(super_admin|module_admin|dept_admin|user)$")
    admin_scope: str | None = Field(None, pattern=r"^(global|department)$")


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    role_type: str
    admin_scope: str | None = None
