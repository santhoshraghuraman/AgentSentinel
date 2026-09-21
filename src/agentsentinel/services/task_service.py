"""
Task Service (Milestone 9).

Manage TaskContext records in the in-memory repository.
"""

from typing import List, Optional

from src.agentsentinel.authorization.models import TaskContext, CapabilityGrant, CapabilityDeny, ActionCategory, ResourceScope, ResourceMatchMode
from src.agentsentinel.repositories.base import BaseTaskRepository
from src.agentsentinel.api.schemas import CreateTaskRequest, SafeTaskResponse


class TaskService:
    """
    Manages in-memory TaskContext records.
    """

    def __init__(self, task_repo: BaseTaskRepository):
        self._task_repo = task_repo

    def create_task(self, request: CreateTaskRequest) -> TaskContext:
        """Create and store a new TaskContext."""
        allowed = []
        for cap in request.allowed_capabilities:
            category_str = cap.get("category", "unknown")
            try:
                category = ActionCategory(category_str)
            except ValueError:
                category = ActionCategory.UNKNOWN

            scope_dict = cap.get("resource_scope")
            resource_scope = None
            if scope_dict:
                try:
                    mode = ResourceMatchMode(scope_dict.get("match_mode", "exact"))
                    resource_scope = ResourceScope(match_mode=mode, value=scope_dict.get("value", ""))
                except ValueError:
                    pass

            ops = cap.get("allowed_operations")
            allowed_ops = tuple(ops) if ops is not None else None
            
            allowed.append(CapabilityGrant(
                category=category,
                allowed_operations=allowed_ops,
                resource_scope=resource_scope
            ))

        denied = []
        for cap in request.denied_capabilities:
            category_str = cap.get("category", "unknown")
            try:
                category = ActionCategory(category_str)
            except ValueError:
                category = ActionCategory.UNKNOWN

            scope_dict = cap.get("resource_scope")
            resource_scope = None
            if scope_dict:
                try:
                    mode = ResourceMatchMode(scope_dict.get("match_mode", "exact"))
                    resource_scope = ResourceScope(match_mode=mode, value=scope_dict.get("value", ""))
                except ValueError:
                    pass

            ops = cap.get("denied_operations")
            denied_ops = tuple(ops) if ops is not None else None
            
            denied.append(CapabilityDeny(
                category=category,
                denied_operations=denied_ops,
                resource_scope=resource_scope
            ))

        task_context = TaskContext(
            task_id=request.task_id,
            task_description=request.task_description,
            allowed_capabilities=tuple(allowed),
            denied_capabilities=tuple(denied)
        )

        self._task_repo.add(task_context)
        return task_context

    def get_task(self, task_id: str) -> Optional[SafeTaskResponse]:
        """Retrieve a TaskContext and return a safe representation."""
        task = self._task_repo.get(task_id)
        if not task:
            return None
            
        return SafeTaskResponse(
            task_id=task.task_id,
            task_description=task.task_description,
            allowed_capability_count=len(task.allowed_capabilities),
            denied_capability_count=len(task.denied_capabilities)
        )

    def list_tasks(self) -> List[SafeTaskResponse]:
        """Return all tasks."""
        tasks = self._task_repo.list_all()
        return [
            SafeTaskResponse(
                task_id=task.task_id,
                task_description=task.task_description,
                allowed_capability_count=len(task.allowed_capabilities),
                denied_capability_count=len(task.denied_capabilities)
            ) for task in tasks
        ]
