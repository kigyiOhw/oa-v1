import logging

from sqlalchemy import select
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
from app.services.notification import NotificationService

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
        logger.info("----------WorkflowEngineService.list_definitions, start")
        result = await self.def_repo.get_all()
        logger.info("----------WorkflowEngineService.list_definitions, done, count=%s", len(result))
        return result

    async def get_definition(self, def_id: int) -> WorkflowDef:
        logger.info("----------WorkflowEngineService.get_definition, start, def_id=%s", def_id)
        wf_def = await self.def_repo.get_by_id(def_id)
        if not wf_def:
            logger.warning("----------WorkflowEngineService.get_definition, not_found, def_id=%s", def_id)
            raise OAException("Workflow definition not found", status_code=404)
        logger.info("----------WorkflowEngineService.get_definition, done, def_id=%s, name=%s", def_id, wf_def.name)
        return wf_def

    async def create_definition(self, data: WorkflowDefCreate) -> WorkflowDef:
        logger.info("----------WorkflowEngineService.create_definition, start, name=%s", data.name)
        self._validate_definition(data.definition)
        wf_def = WorkflowDef(
            name=data.name,
            description=data.description,
            icon=data.icon,
            definition=data.definition,
        )
        result = await self.def_repo.create(wf_def)
        logger.info("----------WorkflowEngineService.create_definition, done, def_id=%s", result.id)
        return result

    async def update_definition(self, def_id: int, data: WorkflowDefUpdate) -> WorkflowDef:
        logger.info("----------WorkflowEngineService.update_definition, start, def_id=%s", def_id)
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
            logger.info("----------WorkflowEngineService.update_definition, version_bumped, def_id=%s, version=%s",
                        def_id, wf_def.version)
        if data.is_active is not None:
            wf_def.is_active = data.is_active
        result = await self.def_repo.update(wf_def)
        logger.info("----------WorkflowEngineService.update_definition, done, def_id=%s", def_id)
        return result

    async def delete_definition(self, def_id: int) -> None:
        logger.info("----------WorkflowEngineService.delete_definition, start, def_id=%s", def_id)
        wf_def = await self.get_definition(def_id)
        active_count = await self.def_repo.count_active_instances(def_id)
        if active_count > 0:
            logger.warning("----------WorkflowEngineService.delete_definition, has_active_instances, def_id=%s, count=%s",
                           def_id, active_count)
            raise OAException(
                f"Cannot delete definition with {active_count} active instances",
                status_code=400,
            )
        await self.def_repo.delete(wf_def)
        logger.info("----------WorkflowEngineService.delete_definition, done, def_id=%s", def_id)

    # -- workflow lifecycle --

    async def start_instance(self, user: User, data: StartInstanceRequest) -> WorkflowInstance:
        logger.info("----------WorkflowEngineService.start_instance, start, user_id=%s, def_id=%s, title=%s",
                    user.id, data.workflow_def_id, data.title)
        wf_def = await self.get_definition(data.workflow_def_id)
        if not wf_def.is_active:
            logger.warning("----------WorkflowEngineService.start_instance, def_inactive, def_id=%s", wf_def.id)
            raise OAException("Workflow definition is not active", status_code=400)

        definition = wf_def.definition
        start_node = self._find_start_node(definition)
        logger.info("----------WorkflowEngineService.start_instance, start_node=%s", start_node["id"])

        transition = self._find_transition(definition, start_node["id"], "submit")
        next_node = self._get_node(definition, transition["to"])
        logger.info("----------WorkflowEngineService.start_instance, next_node=%s, type=%s",
                    next_node["id"], next_node.get("type"))

        instance = WorkflowInstance(
            workflow_def_id=wf_def.id,
            title=data.title,
            initiator_id=user.id,
            current_node_id=start_node["id"],
            form_data=data.form_data or {},
        )
        await self.instance_repo.create(instance)
        logger.info("----------WorkflowEngineService.start_instance, instance_created, instance_id=%s", instance.id)

        logger.info("----------WorkflowEngineService.start_instance, resolving_assignee, node=%s, assignee_type=%s",
                    next_node["id"], next_node.get("assignee_type"))
        assignee_id = await self._resolve_assignee(next_node, user.id)
        logger.info("----------WorkflowEngineService.start_instance, assignee_resolved, assignee_id=%s", assignee_id)

        task = WorkflowTask(
            instance_id=instance.id,
            node_id=next_node["id"],
            assignee_id=assignee_id,
        )
        await self.task_repo.create(task)
        logger.info("----------WorkflowEngineService.start_instance, task_created, task_id=%s, assignee_id=%s",
                    task.id, assignee_id)

        history = WorkflowHistory(
            instance_id=instance.id,
            node_id=start_node["id"],
            action="submit",
            operator_id=user.id,
        )
        await self.history_repo.create(history)

        instance.current_node_id = next_node["id"]
        await self.instance_repo.update(instance)

        await NotificationService.send_notification(
            self.session,
            user_id=assignee_id,
            type_="workflow",
            title="New Task",
            message=f"You have a new approval task: {instance.title}",
            reference_type="task",
            reference_id=task.id,
        )

        logger.info("----------WorkflowEngineService.start_instance, done, instance_id=%s, first_task=%s, assignee=%s",
                    instance.id, task.id, assignee_id)
        return instance

    async def process_task(
        self, user: User, task_id: int, action: str, data: ProcessTaskRequest
    ) -> WorkflowTask:
        logger.info("----------WorkflowEngineService.process_task, start, task_id=%s, action=%s, user_id=%s",
                    task_id, action, user.id)
        task = await self.task_repo.get_by_id_with_instance(task_id)
        if not task:
            logger.warning("----------WorkflowEngineService.process_task, task_not_found, task_id=%s", task_id)
            raise OAException("Task not found", status_code=404)
        if task.assignee_id != user.id:
            logger.warning("----------WorkflowEngineService.process_task, not_assignee, task_id=%s, assignee=%s, requester=%s",
                           task_id, task.assignee_id, user.id)
            raise OAException("You are not the assignee of this task", status_code=403)
        if task.status != "pending":
            logger.warning("----------WorkflowEngineService.process_task, already_processed, task_id=%s, status=%s",
                           task_id, task.status)
            raise OAException("Task has already been processed", status_code=400)

        instance = task.instance
        if instance.status != "pending":
            logger.warning("----------WorkflowEngineService.process_task, instance_not_pending, instance_id=%s, status=%s",
                           instance.id, instance.status)
            raise OAException("Workflow instance is not pending", status_code=400)

        logger.info("----------WorkflowEngineService.process_task, instance_id=%s, current_node=%s",
                    instance.id, instance.current_node_id)
        definition = instance.workflow_def.definition
        current_node_id = instance.current_node_id
        transition = self._find_transition(definition, current_node_id, action)
        next_node = self._get_node(definition, transition["to"])
        logger.info("----------WorkflowEngineService.process_task, transition, from=%s, action=%s, to=%s, type=%s",
                    current_node_id, action, next_node["id"], next_node.get("type"))

        task.status = action
        task.comment = data.comment
        await self.task_repo.update(task)
        logger.info("----------WorkflowEngineService.process_task, task_updated, task_id=%s, status=%s", task.id, action)

        history = WorkflowHistory(
            instance_id=instance.id,
            node_id=current_node_id,
            action=action,
            comment=data.comment,
            operator_id=user.id,
        )
        await self.history_repo.create(history)

        if next_node["type"] == "end":
            outcome = next_node.get("outcome", action)
            logger.info("----------WorkflowEngineService.process_task, end_node_reached, instance_id=%s, outcome=%s",
                        instance.id, outcome)
            instance.status = outcome
            instance.current_node_id = next_node["id"]

            # If this is a Leave Approval workflow, sync leave status + attendance
            if instance.workflow_def.name == "Leave Approval":
                from app.models.leave_request import LeaveRequest
                leave = (await self.session.execute(
                    select(LeaveRequest).where(
                        LeaveRequest.workflow_instance_id == instance.id
                    )
                )).scalar_one_or_none()
                if leave:
                    from app.services.leave import LeaveService
                    leave_svc = LeaveService(self.session)
                    await leave_svc.sync_status(leave)

            # If this is an Expense Approval workflow, sync expense status
            if instance.workflow_def.name == "Expense Approval":
                from app.models.expense_request import ExpenseRequest
                expense = (await self.session.execute(
                    select(ExpenseRequest).where(
                        ExpenseRequest.workflow_instance_id == instance.id
                    )
                )).scalar_one_or_none()
                if expense:
                    from app.services.expense import ExpenseService
                    expense_svc = ExpenseService(self.session)
                    await expense_svc.sync_status(expense)

            # If this is an Overtime Approval workflow, sync overtime status
            if instance.workflow_def.name == "Overtime Approval":
                from app.models.overtime_request import OvertimeRequest
                overtime = (await self.session.execute(
                    select(OvertimeRequest).where(
                        OvertimeRequest.workflow_instance_id == instance.id
                    )
                )).scalar_one_or_none()
                if overtime:
                    from app.services.overtime import OvertimeService
                    overtime_svc = OvertimeService(self.session)
                    await overtime_svc.sync_status(overtime)

            await NotificationService.send_notification(
                self.session,
                user_id=instance.initiator_id,
                type_="workflow",
                title="Approval Result",
                message=f"Your request '{instance.title}' was {outcome}",
                reference_type="instance",
                reference_id=instance.id,
            )
        else:
            logger.info("----------WorkflowEngineService.process_task, resolving_next_assignee, node=%s, assignee_type=%s",
                        next_node["id"], next_node.get("assignee_type"))
            instance.current_node_id = next_node["id"]
            assignee_id = await self._resolve_assignee(next_node, instance.initiator_id)
            logger.info("----------WorkflowEngineService.process_task, next_assignee_resolved, assignee_id=%s", assignee_id)
            new_task = WorkflowTask(
                instance_id=instance.id,
                node_id=next_node["id"],
                assignee_id=assignee_id,
            )
            await self.task_repo.create(new_task)
            logger.info("----------WorkflowEngineService.process_task, next_task_created, task_id=%s, assignee_id=%s",
                        new_task.id, assignee_id)

            await NotificationService.send_notification(
                self.session,
                user_id=assignee_id,
                type_="workflow",
                title="New Task",
                message=f"You have a new approval task: {instance.title}",
                reference_type="task",
                reference_id=new_task.id,
            )

        await self.instance_repo.update(instance)
        logger.info("----------WorkflowEngineService.process_task, done, task_id=%s, action=%s, instance=%s, instance_status=%s",
                    task_id, action, instance.id, instance.status)
        return task

    async def cancel_instance(self, user: User, instance_id: int) -> WorkflowInstance:
        logger.info("----------WorkflowEngineService.cancel_instance, start, instance_id=%s, user_id=%s",
                    instance_id, user.id)
        instance = await self.instance_repo.get_by_id(instance_id)
        if not instance:
            logger.warning("----------WorkflowEngineService.cancel_instance, not_found, instance_id=%s", instance_id)
            raise OAException("Instance not found", status_code=404)
        if instance.initiator_id != user.id:
            logger.warning("----------WorkflowEngineService.cancel_instance, not_initiator, instance_id=%s, initiator=%s, requester=%s",
                           instance_id, instance.initiator_id, user.id)
            raise OAException("Only the initiator can cancel this instance", status_code=403)
        if instance.status != "pending":
            logger.warning("----------WorkflowEngineService.cancel_instance, not_pending, instance_id=%s, status=%s",
                           instance_id, instance.status)
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
        logger.info("----------WorkflowEngineService.cancel_instance, done, instance_id=%s", instance_id)
        return instance

    async def get_my_instances(
        self, user: User, page: int, page_size: int
    ) -> tuple[list[WorkflowInstance], int]:
        logger.info("----------WorkflowEngineService.get_my_instances, start, user_id=%s, page=%s", user.id, page)
        result = await self.instance_repo.get_by_initiator(user.id, page, page_size)
        logger.info("----------WorkflowEngineService.get_my_instances, done, user_id=%s, total=%s", user.id, result[1])
        return result

    async def get_my_tasks(
        self, user: User, page: int, page_size: int
    ) -> tuple[list[WorkflowTask], int]:
        logger.info("----------WorkflowEngineService.get_my_tasks, start, user_id=%s, page=%s", user.id, page)
        result = await self.task_repo.get_pending_by_assignee(user.id, page, page_size)
        logger.info("----------WorkflowEngineService.get_my_tasks, done, user_id=%s, total=%s", user.id, result[1])
        return result

    async def get_instance_detail(self, instance_id: int) -> WorkflowInstance:
        logger.info("----------WorkflowEngineService.get_instance_detail, start, instance_id=%s", instance_id)
        instance = await self.instance_repo.get_by_id_with_all(instance_id)
        if not instance:
            logger.warning("----------WorkflowEngineService.get_instance_detail, not_found, instance_id=%s", instance_id)
            raise OAException("Instance not found", status_code=404)
        logger.info("----------WorkflowEngineService.get_instance_detail, done, instance_id=%s, status=%s",
                    instance_id, instance.status)
        return instance

    async def get_task_detail(self, task_id: int) -> WorkflowTask:
        logger.info("----------WorkflowEngineService.get_task_detail, start, task_id=%s", task_id)
        task = await self.task_repo.get_by_id_with_instance(task_id)
        if not task:
            logger.warning("----------WorkflowEngineService.get_task_detail, not_found, task_id=%s", task_id)
            raise OAException("Task not found", status_code=404)
        logger.info("----------WorkflowEngineService.get_task_detail, done, task_id=%s, status=%s", task_id, task.status)
        return task

    async def get_pending_task_count(self, user: User) -> int:
        count = await self.task_repo.get_pending_count(user.id)
        logger.info("----------WorkflowEngineService.get_pending_task_count, done, user_id=%s, count=%s", user.id, count)
        return count

    async def get_instance_count(self, user: User) -> int:
        instances, total = await self.instance_repo.get_by_initiator(user.id, 1, 1)
        logger.info("----------WorkflowEngineService.get_instance_count, done, user_id=%s, total=%s", user.id, total)
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
        logger.info("----------WorkflowEngineService._find_transition, from=%s, action=%s", from_node_id, action)
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
        logger.info("----------WorkflowEngineService._resolve_assignee, start, type=%s, value=%s, initiator=%s",
                    assignee_type, assignee_value, initiator_id)

        if assignee_type == "initiator":
            logger.info("----------WorkflowEngineService._resolve_assignee, resolved=initiator, user_id=%s", initiator_id)
            return initiator_id

        elif assignee_type == "manager":
            initiator = await self.user_repo.get_by_id(initiator_id)
            if not initiator or not initiator.manager_id:
                logger.warning("----------WorkflowEngineService._resolve_assignee, no_manager, initiator_id=%s", initiator_id)
                raise OAException(
                    f"Initiator (id={initiator_id}) has no manager assigned", status_code=400
                )
            logger.info("----------WorkflowEngineService._resolve_assignee, resolved=manager, manager_id=%s", initiator.manager_id)
            return initiator.manager_id

        elif assignee_type == "role":
            logger.info("----------WorkflowEngineService._resolve_assignee, looking_up_role, role=%s", assignee_value)
            role = await self.role_repo.get_by_name(assignee_value)
            if not role:
                logger.warning("----------WorkflowEngineService._resolve_assignee, role_not_found, role=%s", assignee_value)
                raise OAException(f"Role '{assignee_value}' not found", status_code=400)
            role_users = list(role.users) if role.users else []
            if not role_users:
                logger.warning("----------WorkflowEngineService._resolve_assignee, no_users_in_role, role=%s", assignee_value)
                raise OAException(f"No users with role '{assignee_value}'", status_code=400)
            user_ids = [u.id for u in role_users]
            logger.info("----------WorkflowEngineService._resolve_assignee, role_users_found, count=%s, user_ids=%s",
                        len(user_ids), user_ids)
            result = await self._pick_least_loaded(user_ids)
            logger.info("----------WorkflowEngineService._resolve_assignee, resolved=role, user_id=%s", result)
            return result

        elif assignee_type == "user":
            if not assignee_value:
                raise OAException("Missing assignee_value for user type", status_code=400)
            logger.info("----------WorkflowEngineService._resolve_assignee, resolved=user, user_id=%s", assignee_value)
            return int(assignee_value)

        else:
            logger.error("----------WorkflowEngineService._resolve_assignee, unknown_type, type=%s", assignee_type)
            raise OAException(f"Unknown assignee_type: {assignee_type}", status_code=400)

    async def _pick_least_loaded(self, user_ids: list[int]) -> int:
        logger.info("----------WorkflowEngineService._pick_least_loaded, candidates=%s", user_ids)
        counts = await self.task_repo.get_pending_count_by_users(user_ids)
        result = min(user_ids, key=lambda uid: counts.get(uid, 0))
        logger.info("----------WorkflowEngineService._pick_least_loaded, picked=%s, counts=%s", result, counts)
        return result
