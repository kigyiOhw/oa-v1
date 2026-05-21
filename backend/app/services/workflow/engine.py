import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.user import User
from app.models.workflow import WorkflowDef, WorkflowHistory, WorkflowInstance, WorkflowTask
from app.repositories.role import RoleRepository
from app.repositories.user import UserRepository
from app.repositories.workflow_def import WorkflowDefRepository
from app.repositories.workflow_history import WorkflowHistoryRepository
from app.repositories.workflow_instance import WorkflowInstanceRepository
from app.repositories.workflow_task import WorkflowTaskRepository
from app.schemas.workflow import (
    ProcessTaskRequest,
    StartInstanceRequest,
    WorkflowDefCreate,
    WorkflowDefUpdate,
)

logger = logging.getLogger(__name__)


class WorkflowEngineService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.def_repo = WorkflowDefRepository(session)
        self.instance_repo = WorkflowInstanceRepository(session)
        self.task_repo = WorkflowTaskRepository(session)
        self.history_repo = WorkflowHistoryRepository(session)
        self.user_repo = UserRepository(session)
        self.role_repo = RoleRepository(session)

    # -- definition management --

    async def list_definitions(self) -> list[WorkflowDef]:
        return await self.def_repo.get_all()

    async def get_definition(self, def_id: int) -> WorkflowDef:
        wf_def = await self.def_repo.get_by_id(def_id)
        if not wf_def:
            raise OAException("Workflow definition not found", status_code=404)
        return wf_def

    async def create_definition(self, data: WorkflowDefCreate) -> WorkflowDef:
        self._validate_definition(data.definition)
        wf_def = WorkflowDef(
            name=data.name,
            description=data.description,
            icon=data.icon,
            definition=data.definition,
        )
        return await self.def_repo.create(wf_def)

    async def update_definition(self, def_id: int, data: WorkflowDefUpdate) -> WorkflowDef:
        wf_def = await self.get_definition(def_id)
        if data.name is not None:
            wf_def.name = data.name
        if data.description is not None:
            wf_def.description = data.description
        if data.icon is not None:
            wf_def.icon = data.icon
        if data.definition is not None:
            self._validate_definition(data.definition)
            wf_def.definition = data.definition
            wf_def.version += 1
        if data.is_active is not None:
            wf_def.is_active = data.is_active
        return await self.def_repo.update(wf_def)

    async def delete_definition(self, def_id: int) -> None:
        wf_def = await self.get_definition(def_id)
        active_count = await self.def_repo.count_active_instances(def_id)
        if active_count > 0:
            raise OAException(
                f"Cannot delete definition with {active_count} active instances",
                status_code=400,
            )
        await self.def_repo.delete(wf_def)

    # -- workflow lifecycle --

    async def start_instance(self, user: User, data: StartInstanceRequest) -> WorkflowInstance:
        wf_def = await self.get_definition(data.workflow_def_id)
        if not wf_def.is_active:
            raise OAException("Workflow definition is not active", status_code=400)

        definition = wf_def.definition
        start_node = self._find_start_node(definition)
        transition = self._find_transition(definition, start_node["id"], "submit")
        next_node = self._get_node(definition, transition["to"])

        instance = WorkflowInstance(
            workflow_def_id=wf_def.id,
            title=data.title,
            initiator_id=user.id,
            current_node_id=start_node["id"],
            form_data=data.form_data or {},
        )
        await self.instance_repo.create(instance)

        assignee_id = await self._resolve_assignee(next_node, user.id)
        task = WorkflowTask(
            instance_id=instance.id,
            node_id=next_node["id"],
            assignee_id=assignee_id,
        )
        await self.task_repo.create(task)

        history = WorkflowHistory(
            instance_id=instance.id,
            node_id=start_node["id"],
            action="submit",
            operator_id=user.id,
        )
        await self.history_repo.create(history)

        instance.current_node_id = next_node["id"]
        await self.instance_repo.update(instance)

        logger.info(
            "Workflow instance started | instance_id=%s def_id=%s initiator_id=%s",
            instance.id, wf_def.id, user.id,
        )
        return instance

    async def process_task(
        self, user: User, task_id: int, action: str, data: ProcessTaskRequest
    ) -> WorkflowTask:
        task = await self.task_repo.get_by_id_with_instance(task_id)
        if not task:
            raise OAException("Task not found", status_code=404)
        if task.assignee_id != user.id:
            raise OAException("You are not the assignee of this task", status_code=403)
        if task.status != "pending":
            raise OAException("Task has already been processed", status_code=400)

        instance = task.instance
        if instance.status != "pending":
            raise OAException("Workflow instance is not pending", status_code=400)

        definition = instance.workflow_def.definition
        current_node_id = instance.current_node_id
        transition = self._find_transition(definition, current_node_id, action)
        next_node = self._get_node(definition, transition["to"])

        task.status = action
        task.comment = data.comment
        await self.task_repo.update(task)

        history = WorkflowHistory(
            instance_id=instance.id,
            node_id=current_node_id,
            action=action,
            comment=data.comment,
            operator_id=user.id,
        )
        await self.history_repo.create(history)

        if next_node["type"] == "end":
            instance.status = next_node.get("outcome", action)
            instance.current_node_id = next_node["id"]
        else:
            instance.current_node_id = next_node["id"]
            assignee_id = await self._resolve_assignee(next_node, instance.initiator_id)
            new_task = WorkflowTask(
                instance_id=instance.id,
                node_id=next_node["id"],
                assignee_id=assignee_id,
            )
            await self.task_repo.create(new_task)

        await self.instance_repo.update(instance)
        logger.info(
            "Task processed | task_id=%s action=%s next_node=%s instance_status=%s",
            task_id, action, next_node["id"], instance.status,
        )
        return task

    async def cancel_instance(self, user: User, instance_id: int) -> WorkflowInstance:
        instance = await self.instance_repo.get_by_id(instance_id)
        if not instance:
            raise OAException("Instance not found", status_code=404)
        if instance.initiator_id != user.id:
            raise OAException("Only the initiator can cancel this instance", status_code=403)
        if instance.status != "pending":
            raise OAException("Instance is not pending and cannot be cancelled", status_code=400)

        instance.status = "cancelled"
        await self.instance_repo.update(instance)

        history = WorkflowHistory(
            instance_id=instance.id,
            node_id=instance.current_node_id,
            action="cancel",
            operator_id=user.id,
        )
        await self.history_repo.create(history)
        return instance

    async def get_my_instances(
        self, user: User, page: int, page_size: int
    ) -> tuple[list[WorkflowInstance], int]:
        return await self.instance_repo.get_by_initiator(user.id, page, page_size)

    async def get_my_tasks(
        self, user: User, page: int, page_size: int
    ) -> tuple[list[WorkflowTask], int]:
        return await self.task_repo.get_pending_by_assignee(user.id, page, page_size)

    async def get_instance_detail(self, instance_id: int) -> WorkflowInstance:
        instance = await self.instance_repo.get_by_id_with_all(instance_id)
        if not instance:
            raise OAException("Instance not found", status_code=404)
        return instance

    async def get_task_detail(self, task_id: int) -> WorkflowTask:
        task = await self.task_repo.get_by_id_with_instance(task_id)
        if not task:
            raise OAException("Task not found", status_code=404)
        return task

    async def get_pending_task_count(self, user: User) -> int:
        return await self.task_repo.get_pending_count(user.id)

    async def get_instance_count(self, user: User) -> int:
        instances, total = await self.instance_repo.get_by_initiator(user.id, 1, 1)
        return total

    # -- helpers --

    @staticmethod
    def _validate_definition(definition: dict) -> None:
        nodes = definition.get("nodes", [])
        transitions = definition.get("transitions", [])
        if not nodes:
            raise OAException("Definition must have at least one node", status_code=400)
        if not transitions:
            raise OAException("Definition must have at least one transition", status_code=400)
        node_ids = {n["id"] for n in nodes}
        node_types = {n["type"] for n in nodes}
        if "start" not in node_types:
            raise OAException("Definition must have a start node", status_code=400)
        if "end" not in node_types:
            raise OAException("Definition must have an end node", status_code=400)
        for t in transitions:
            if t["from"] not in node_ids:
                raise OAException(
                    f"Transition 'from' node '{t['from']}' not found", status_code=400
                )
            if t["to"] not in node_ids:
                raise OAException(
                    f"Transition 'to' node '{t['to']}' not found", status_code=400
                )

    @staticmethod
    def _find_start_node(definition: dict) -> dict:
        for node in definition["nodes"]:
            if node["type"] == "start":
                return node
        raise OAException("No start node found in definition", status_code=400)

    @staticmethod
    def _find_transition(definition: dict, from_node_id: str, action: str) -> dict:
        for t in definition["transitions"]:
            if t["from"] == from_node_id and t["action"] == action:
                return t
        raise OAException(
            f"No transition found from '{from_node_id}' with action '{action}'",
            status_code=400,
        )

    @staticmethod
    def _get_node(definition: dict, node_id: str) -> dict:
        for node in definition["nodes"]:
            if node["id"] == node_id:
                return node
        raise OAException(f"Node '{node_id}' not found in definition", status_code=400)

    async def _resolve_assignee(self, node: dict, initiator_id: int) -> int:
        assignee_type = node.get("assignee_type")
        assignee_value = node.get("assignee_value")

        if assignee_type == "initiator":
            return initiator_id
        elif assignee_type == "manager":
            initiator = await self.user_repo.get_by_id(initiator_id)
            if not initiator or not initiator.manager_id:
                raise OAException(
                    f"Initiator (id={initiator_id}) has no manager assigned", status_code=400
                )
            return initiator.manager_id
        elif assignee_type == "role":
            role = await self.role_repo.get_by_name(assignee_value)
            if not role:
                raise OAException(f"Role '{assignee_value}' not found", status_code=400)
            role_users = list(role.users) if role.users else []
            if not role_users:
                raise OAException(f"No users with role '{assignee_value}'", status_code=400)
            user_ids = [u.id for u in role_users]
            return await self._pick_least_loaded(user_ids)
        elif assignee_type == "user":
            if not assignee_value:
                raise OAException("Missing assignee_value for user type", status_code=400)
            return int(assignee_value)
        else:
            raise OAException(f"Unknown assignee_type: {assignee_type}", status_code=400)

    async def _pick_least_loaded(self, user_ids: list[int]) -> int:
        counts = await self.task_repo.get_pending_count_by_users(user_ids)
        return min(user_ids, key=lambda uid: counts.get(uid, 0))
