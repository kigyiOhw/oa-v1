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
from app.services.notification import NotificationService
from app.services.workflow.hooks import get_hook

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
            on_complete_hook=data.on_complete_hook,
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
        if data.on_complete_hook is not None:
            wf_def.on_complete_hook = data.on_complete_hook
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

    @staticmethod
    def validate_definition(definition: dict) -> tuple[bool, list[str]]:
        errors: list[str] = []
        try:
            WorkflowEngineService._validate_definition(definition)
        except OAException as e:
            errors.append(str(e.detail) if hasattr(e, "detail") else str(e))
        except Exception as e:
            errors.append(f"Validation error: {e}")
        return len(errors) == 0, errors

    # -- workflow lifecycle --

    @staticmethod
    def _resolve_action_node(definition: dict, from_node_id: str, action: str, form_data: dict | None = None) -> dict:
        """Follow transitions, auto-skipping condition nodes, until reaching a non-condition node."""
        current_id = from_node_id
        current_action = action
        visited = set()
        while True:
            transition = WorkflowEngineService._find_transition(definition, current_id, current_action, form_data)
            next_node = WorkflowEngineService._get_node(definition, transition["to"])
            if next_node.get("type") != "condition":
                return next_node
            current_id = next_node["id"]
            current_action = "default"
            if current_id in visited:
                raise OAException("Condition loop detected in definition", status_code=400)
            visited.add(current_id)

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

        next_node = self._resolve_action_node(definition, start_node["id"], "submit", data.form_data)
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
        chain_index = 0 if next_node.get("assignee_type") == "chain" else None
        logger.info("----------WorkflowEngineService.start_instance, assignee_resolved, assignee_id=%s, chain_index=%s", assignee_id, chain_index)

        task = WorkflowTask(
            instance_id=instance.id,
            node_id=next_node["id"],
            assignee_id=assignee_id,
            chain_index=chain_index,
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

        # Handle multi-level approval chain
        current_node = self._get_node(definition, current_node_id)
        if action == "approve" and task.chain_index is not None and current_node.get("assignee_type") == "chain":
            chain = current_node.get("assignee_chain", [])
            next_index = task.chain_index + 1
            if next_index < len(chain):
                # Chain continues: create next task at same node
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

                next_assignee_id = await self._resolve_chain_assignee(chain[next_index], instance.initiator_id)
                new_task = WorkflowTask(
                    instance_id=instance.id,
                    node_id=current_node_id,
                    assignee_id=next_assignee_id,
                    chain_index=next_index,
                )
                await self.task_repo.create(new_task)
                logger.info("----------WorkflowEngineService.process_task, chain_next_task_created, task_id=%s, assignee_id=%s, chain_index=%s",
                            new_task.id, next_assignee_id, next_index)
                await NotificationService.send_notification(
                    self.session,
                    user_id=next_assignee_id,
                    type_="workflow",
                    title="New Task",
                    message=f"You have a new approval task: {instance.title}",
                    reference_type="task",
                    reference_id=new_task.id,
                )
                await self.instance_repo.update(instance)
                logger.info("----------WorkflowEngineService.process_task, done_chain, task_id=%s, action=%s, instance=%s",
                            task_id, action, instance.id)
                return task

        next_node = self._resolve_action_node(definition, current_node_id, action, instance.form_data)
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

            # Dispatch completion hook by name (plugin-style, no hardcoded module branches)
            hook_name = instance.workflow_def.on_complete_hook
            if hook_name:
                hook = get_hook(hook_name)
                if hook:
                    logger.info(
                        "Dispatching hook '%s' for instance_id=%s",
                        hook_name, instance.id,
                    )
                    await hook(self.session, instance)
                else:
                    logger.warning(
                        "Hook '%s' not registered — skipping for instance_id=%s",
                        hook_name, instance.id,
                    )

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
            chain_index = 0 if next_node.get("assignee_type") == "chain" else None
            logger.info("----------WorkflowEngineService.process_task, next_assignee_resolved, assignee_id=%s, chain_index=%s", assignee_id, chain_index)
            new_task = WorkflowTask(
                instance_id=instance.id,
                node_id=next_node["id"],
                assignee_id=assignee_id,
                chain_index=chain_index,
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

    async def get_instance_detail(self, user: User, instance_id: int) -> WorkflowInstance:
        logger.info("----------WorkflowEngineService.get_instance_detail, start, instance_id=%s, user_id=%s", instance_id, user.id)
        instance = await self.instance_repo.get_by_id_with_all(instance_id)
        if not instance:
            logger.warning("----------WorkflowEngineService.get_instance_detail, not_found, instance_id=%s", instance_id)
            raise OAException("Instance not found", status_code=404)
        if instance.initiator_id != user.id and not user.is_superuser:
            has_task = await self.task_repo.has_task_in_instance(user.id, instance_id)
            if not has_task:
                logger.warning("----------WorkflowEngineService.get_instance_detail, access_denied, user_id=%s, instance_id=%s", user.id, instance_id)
                raise OAException("Access denied", status_code=403)
        logger.info("----------WorkflowEngineService.get_instance_detail, done, instance_id=%s, status=%s",
                    instance_id, instance.status)
        return instance

    async def get_task_detail(self, user: User, task_id: int) -> WorkflowTask:
        logger.info("----------WorkflowEngineService.get_task_detail, start, task_id=%s, user_id=%s", task_id, user.id)
        task = await self.task_repo.get_by_id_with_instance(task_id)
        if not task:
            logger.warning("----------WorkflowEngineService.get_task_detail, not_found, task_id=%s", task_id)
            raise OAException("Task not found", status_code=404)
        if task.assignee_id != user.id and not user.is_superuser:
            logger.warning("----------WorkflowEngineService.get_task_detail, access_denied, user_id=%s, task_id=%s", user.id, task_id)
            raise OAException("Access denied", status_code=403)
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

        # Basic transition validation
        valid_ops = {"==", "!=", ">", "<", ">=", "<=", "in", "contains"}
        for t in transitions:
            if t["from"] not in node_ids:
                raise OAException(f"Transition 'from' node '{t['from']}' not found", status_code=400)
            if t["to"] not in node_ids:
                raise OAException(f"Transition 'to' node '{t['to']}' not found", status_code=400)
            conditions = t.get("conditions")
            if conditions:
                WorkflowEngineService._validate_conditions(conditions, valid_ops)

        # Node-specific validation
        for node in nodes:
            ntype = node.get("type")
            if ntype in ("approval", "task"):
                atype = node.get("assignee_type")
                if atype == "chain":
                    chain = node.get("assignee_chain", [])
                    if not chain:
                        raise OAException(f"Node '{node['id']}' has assignee_type=chain but empty assignee_chain", status_code=400)
                    for elem in chain:
                        if elem.get("type") not in ("initiator", "manager", "role", "user"):
                            raise OAException(f"Invalid chain element type: {elem.get('type')}", status_code=400)
                elif atype not in ("initiator", "manager", "role", "user"):
                    raise OAException(f"Node '{node['id']}' must have a valid assignee_type or assignee_chain", status_code=400)
            elif ntype == "end":
                if not node.get("outcome"):
                    raise OAException(f"End node '{node['id']}' must have an outcome", status_code=400)
            elif ntype == "condition":
                out_count = sum(1 for t in transitions if t["from"] == node["id"])
                if out_count < 2:
                    raise OAException(f"Condition node '{node['id']}' must have at least 2 outgoing transitions", status_code=400)

        # Dead-loop detection (DFS)
        adj = {nid: [] for nid in node_ids}
        for t in transitions:
            adj[t["from"]].append(t["to"])

        start_node = next((n for n in nodes if n["type"] == "start"), None)
        if start_node:
            visited = set()
            path = set()
            def dfs(node_id: str):
                if node_id in path:
                    raise OAException(f"Dead loop detected involving node '{node_id}'", status_code=400)
                if node_id in visited:
                    return
                visited.add(node_id)
                path.add(node_id)
                for next_id in adj.get(node_id, []):
                    dfs(next_id)
                path.remove(node_id)
            dfs(start_node["id"])

            # Orphaned nodes detection
            unreachable = node_ids - visited
            if unreachable:
                raise OAException(f"Orphaned nodes detected: {', '.join(sorted(unreachable))}", status_code=400)

    @staticmethod
    def _find_start_node(definition: dict) -> dict:
        for node in definition["nodes"]:
            if node["type"] == "start":
                return node
        raise OAException("No start node found in definition", status_code=400)

    @staticmethod
    def _find_transition(definition: dict, from_node_id: str, action: str, form_data: dict | None = None) -> dict:
        logger.info("----------WorkflowEngineService._find_transition, from=%s, action=%s", from_node_id, action)
        candidates = [t for t in definition["transitions"] if t["from"] == from_node_id and t["action"] == action]
        if not candidates:
            raise OAException(
                f"No transition found from '{from_node_id}' with action '{action}'",
                status_code=400,
            )
        for t in candidates:
            conditions = t.get("conditions")
            if not conditions:
                return t
            if form_data is not None and WorkflowEngineService._evaluate_conditions(form_data, conditions):
                return t
        raise OAException(
            f"No matching transition from '{from_node_id}' with action '{action}'",
            status_code=400,
        )

    @staticmethod
    def _evaluate_conditions(form_data: dict, conditions: dict | list[dict]) -> bool:
        """Evaluate conditions with nested AND/OR group support.

        Supports:
        - Flat list of rules (legacy, treated as AND):
          [{"field": "amount", "operator": ">", "value": 5000}, ...]
        - Group object with operator + rules:
          {"operator": "AND", "rules": [...]}
        - Nested groups:
          {"operator": "AND", "rules": [
              {"field": "amount", "operator": ">", "value": 5000},
              {"operator": "OR", "rules": [...]}
          ]}
        """
        if isinstance(conditions, list):
            # Legacy flat list — treat as AND
            return all(
                WorkflowEngineService._evaluate_condition(form_data, c) for c in conditions
            )

        if isinstance(conditions, dict):
            # Distinguish leaf dict (has "field") from group dict (has "rules")
            if "field" in conditions:
                return WorkflowEngineService._evaluate_condition(form_data, conditions)
            operator = conditions.get("operator", "AND")
            rules = conditions.get("rules", [])
            if operator == "AND":
                for rule in rules:
                    if not WorkflowEngineService._evaluate_conditions(form_data, rule):
                        return False
                return True
            elif operator == "OR":
                for rule in rules:
                    if WorkflowEngineService._evaluate_conditions(form_data, rule):
                        return True
                return False
            else:
                return False

        return False

    @staticmethod
    def _evaluate_condition(form_data: dict, condition: dict) -> bool:
        """Evaluate a single leaf condition."""
        field = condition.get("field")
        op = condition.get("operator")
        value = condition.get("value")
        actual = form_data.get(field) if form_data else None
        return WorkflowEngineService._compare(actual, op, value)

    @staticmethod
    def _compare(actual: any, op: str, expected: any) -> bool:
        try:
            if op == "==":
                return actual == expected
            elif op == "!=":
                return actual != expected
            elif op == ">":
                return float(actual) > float(expected)
            elif op == "<":
                return float(actual) < float(expected)
            elif op == ">=":
                return float(actual) >= float(expected)
            elif op == "<=":
                return float(actual) <= float(expected)
            elif op == "in":
                return actual in expected if isinstance(expected, (list, tuple, set)) else str(actual) in str(expected)
            elif op == "contains":
                return expected in actual if isinstance(actual, (list, tuple, set, str)) else str(expected) in str(actual)
            else:
                return False
        except (TypeError, ValueError):
            return False

    @staticmethod
    def _validate_conditions(conditions: dict | list, valid_ops: set[str]) -> None:
        """Recursively validate conditions structure.

        Supports:
        - Flat list of leaf rules: [{"field": "x", "operator": ">", "value": 1}, ...]
        - Group object: {"operator": "AND", "rules": [...]}
        - Nested groups.
        """
        if isinstance(conditions, list):
            if len(conditions) == 0:
                raise OAException("Transition conditions must be a non-empty list", status_code=400)
            for c in conditions:
                if not isinstance(c, dict):
                    raise OAException("Condition must be an object", status_code=400)
                if c.get("operator") not in valid_ops:
                    raise OAException(f"Invalid condition operator: {c.get('operator')}", status_code=400)
                if "field" not in c:
                    raise OAException("Condition must have a 'field'", status_code=400)
        elif isinstance(conditions, dict):
            # Distinguish leaf dict (has "field") from group dict (has "rules")
            if "field" in conditions:
                # Leaf rule in dict form
                op = conditions.get("operator")
                if op not in valid_ops:
                    raise OAException(f"Invalid condition operator: {op}", status_code=400)
                if "field" not in conditions:
                    raise OAException("Condition must have a 'field'", status_code=400)
            else:
                # Group
                operator = conditions.get("operator")
                if operator not in ("AND", "OR"):
                    raise OAException(f"Condition group operator must be AND or OR, got: {operator}", status_code=400)
                rules = conditions.get("rules", [])
                if not rules:
                    raise OAException("Condition group must have non-empty 'rules'", status_code=400)
                for rule in rules:
                    WorkflowEngineService._validate_conditions(rule, valid_ops)
        else:
            raise OAException("Conditions must be a list or an object", status_code=400)

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

        elif assignee_type == "chain":
            chain = node.get("assignee_chain", [])
            if not chain:
                raise OAException("assignee_chain is empty for chain type", status_code=400)
            logger.info("----------WorkflowEngineService._resolve_assignee, resolved=chain_first, type=%s", chain[0].get("type"))
            return await self._resolve_chain_assignee(chain[0], initiator_id)

        else:
            logger.error("----------WorkflowEngineService._resolve_assignee, unknown_type, type=%s", assignee_type)
            raise OAException(f"Unknown assignee_type: {assignee_type}", status_code=400)

    async def _resolve_chain_assignee(self, chain_elem: dict, initiator_id: int) -> int:
        elem_type = chain_elem.get("type")
        elem_value = chain_elem.get("value")
        fake_node = {"assignee_type": elem_type, "assignee_value": elem_value}
        return await self._resolve_assignee(fake_node, initiator_id)

    async def _pick_least_loaded(self, user_ids: list[int]) -> int:
        logger.info("----------WorkflowEngineService._pick_least_loaded, candidates=%s", user_ids)
        counts = await self.task_repo.get_pending_count_by_users(user_ids)
        result = min(user_ids, key=lambda uid: counts.get(uid, 0))
        logger.info("----------WorkflowEngineService._pick_least_loaded, picked=%s, counts=%s", result, counts)
        return result
