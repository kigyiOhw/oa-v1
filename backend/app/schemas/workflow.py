from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# -- Workflow Definition --
class WorkflowDefCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    icon: str | None = Field(None, max_length=50)
    definition: dict
    on_complete_hook: str | None = Field(None, max_length=100)


class WorkflowDefUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    description: str | None = None
    icon: str | None = None
    definition: dict | None = None
    is_active: bool | None = None
    on_complete_hook: str | None = Field(None, max_length=100)


class WorkflowDefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    icon: str | None = None
    definition: dict
    is_active: bool
    version: int
    on_complete_hook: str | None = None
    created_at: datetime
    updated_at: datetime


# -- Workflow Instance --
class StartInstanceRequest(BaseModel):
    workflow_def_id: int
    title: str = Field(..., max_length=200)
    form_data: dict | None = None


class WorkflowInstanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workflow_def_id: int
    title: str
    initiator_id: int
    status: str
    current_node_id: str
    form_data: dict | None = None
    created_at: datetime
    updated_at: datetime


class WorkflowInstanceDetailOut(WorkflowInstanceOut):
    workflow_def: WorkflowDefOut | None = None
    tasks: list["WorkflowTaskOut"] | None = None
    history: list["WorkflowHistoryOut"] | None = None


# -- Workflow Task --
class ProcessTaskRequest(BaseModel):
    comment: str | None = None


class WorkflowTaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    instance_id: int
    node_id: str
    assignee_id: int
    status: str
    comment: str | None = None
    chain_index: int | None = None
    created_at: datetime
    updated_at: datetime


class WorkflowTaskDetailOut(WorkflowTaskOut):
    instance: WorkflowInstanceOut | None = None


# -- Workflow History --
class WorkflowHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    instance_id: int
    node_id: str
    action: str
    comment: str | None = None
    operator_id: int
    created_at: datetime


# -- Validation --
class ValidateDefinitionRequest(BaseModel):
    definition: dict


class ValidateDefinitionResponse(BaseModel):
    valid: bool
    errors: list[str] = []


# -- Paginated responses --
class PaginatedInstances(BaseModel):
    items: list[WorkflowInstanceOut]
    total: int
    page: int
    page_size: int


class PaginatedTasks(BaseModel):
    items: list[WorkflowTaskOut]
    total: int
    page: int
    page_size: int
