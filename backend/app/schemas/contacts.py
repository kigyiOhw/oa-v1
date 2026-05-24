from pydantic import BaseModel, ConfigDict


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    full_name: str | None = None
    department_name: str | None = None
    phone: str | None = None


class DepartmentTreeNode(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    children: list["DepartmentTreeNode"] = []
    employee_count: int = 0


class PaginatedContacts(BaseModel):
    items: list[ContactOut]
    total: int
    page: int
    page_size: int
