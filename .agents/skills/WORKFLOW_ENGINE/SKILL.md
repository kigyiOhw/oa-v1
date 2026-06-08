# WORKFLOW_ENGINE

You are an expert on the OA system's workflow engine. This is the core differentiator of the project — a JSONB-definition-driven, configurable approval workflow engine.

## When to Invoke

Invoke when the task involves:
- Creating, modifying, or debugging workflow definitions (JSONB nodes + transitions)
- Changing approval routing logic (assignee resolution strategies)
- Adding new assignee types or modifying `_resolve_assignee()`
- Debugging workflow instance/task lifecycle issues
- Adding status sync hooks for new business modules (leave/expense/overtime pattern)
- Modifying the least-loaded load balancing algorithm
- Adding workflow validation rules

## Architecture (4 tables)

```
workflow_defs     → JSONB definition (nodes[] + transitions[])
workflow_instances → instance lifecycle (status, current_node_id, form_data)
workflow_tasks    → approval tasks (assignee_id, status, comment)
workflow_history  → complete audit trail (node_id, action, operator_id)
```

## Key Files

| File | Role |
|------|------|
| `backend/app/services/workflow/engine.py` | Core engine: start/process/cancel, assignee resolution, validation |
| `backend/app/models/workflow.py` | 4 ORM models (WorkflowDef, WorkflowInstance, WorkflowTask, WorkflowHistory) |
| `backend/app/repositories/workflow_*.py` | 4 repository files (def, instance, task, history) |
| `backend/app/schemas/workflow.py` | Pydantic schemas for all workflow operations |
| `backend/app/api/v1/workflow.py` | User-facing endpoints (start, process, my instances/tasks) |
| `backend/app/api/v1/workflow_defs.py` | Admin CRUD for workflow definitions |

## Definition JSONB Structure

```json
{
  "nodes": [
    {"id": "start", "type": "start", "label": "提交"},
    {"id": "manager_approve", "type": "approval", "label": "经理审批",
     "assignee_type": "manager"},
    {"id": "hr_approve", "type": "approval", "label": "HR审批",
     "assignee_type": "role", "assignee_value": "hr_admin"},
    {"id": "end_approved", "type": "end", "label": "通过", "outcome": "approved"},
    {"id": "end_rejected", "type": "end", "label": "驳回", "outcome": "rejected"}
  ],
  "transitions": [
    {"from": "start", "action": "submit", "to": "manager_approve"},
    {"from": "manager_approve", "action": "approve", "to": "hr_approve"},
    {"from": "manager_approve", "action": "reject", "to": "end_rejected"},
    {"from": "hr_approve", "action": "approve", "to": "end_approved"},
    {"from": "hr_approve", "action": "reject", "to": "end_rejected"}
  ]
}
```

Node types: `start`, `approval`, `end` (end nodes MUST have `outcome`)
Transition actions: `submit`, `approve`, `reject` (extensible)

## 4 Assignee Resolution Strategies

| Type | assignee_value | Logic |
|------|---------------|-------|
| `initiator` | (ignored) | Returns the workflow initiator |
| `manager` | (ignored) | `initiator.manager_id` — fails if no manager |
| `role` | role name string | Gets all users with that role, picks least-loaded (fewest pending tasks) |
| `user` | user ID integer | Direct assignment to specified user |

Least-loaded algorithm: `WorkflowTaskRepository.get_pending_count_by_users(user_ids)` → `min(user_ids, key=lambda uid: counts.get(uid, 0))`

## Business Module Status Sync (Critical Pattern)

In `process_task()`, when reaching an end node, the engine checks `instance.workflow_def.name` and syncs the linked business record:

```
if instance.workflow_def.name == "Leave Approval":
    → LeaveService.sync_status(leave)  # approved → create attendance leave records
if instance.workflow_def.name == "Expense Approval":
    → ExpenseService.sync_status(expense)
if instance.workflow_def.name == "Overtime Approval":
    → OvertimeService.sync_status(overtime)
```

**⚠️ Tech debt**: This is hardcoded with if-branches. Adding a new module requires adding another if block. A registration/observer pattern would be cleaner but has not been implemented yet. For now, follow the existing pattern when adding new workflow-linked modules.

## Validation Rules

`_validate_definition()` checks:
1. At least 1 node and 1 transition
2. Must have a `start` type node
3. Must have an `end` type node
4. All transition `from` and `to` values must reference existing node IDs

## Notification Integration

The engine calls `NotificationService.send_notification()` at 3 points:
- `start_instance()`: notify the first assignee (type: "workflow")
- `process_task()` middle node: notify next assignee
- `process_task()` end node: notify initiator of result
