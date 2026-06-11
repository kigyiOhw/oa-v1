from pydantic import BaseModel, ConfigDict, Field


class RequestTypeCreate(BaseModel):
    module: str = Field(..., pattern=r"^(leave|expense)$")
    code: str = Field(..., min_length=1, max_length=30)
    name: str = Field(..., min_length=1, max_length=50)
    sort_order: int = Field(0, ge=0)
    is_active: bool = True


class RequestTypeUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50)
    sort_order: int | None = Field(None, ge=0)
    is_active: bool | None = None


class RequestTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    module: str
    code: str
    name: str
    sort_order: int
    is_active: bool
