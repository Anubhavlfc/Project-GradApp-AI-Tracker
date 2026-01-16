"""
MCP Tool: Calendar & Todo Manager
Manages deadlines, tasks, and reminders for graduate applications.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import sys

sys.path.insert(0, '../backend')

from backend.database import (
    create_task, get_task, get_all_tasks, get_tasks_by_application,
    get_tasks_by_status, get_upcoming_tasks, update_task, delete_task,
    get_task_stats, get_all_applications
)


class CalendarTodoTool:
    """
    MCP Tool for managing calendar and to-do items.
    Handles deadlines, tasks, and reminders for grad applications.
    """

    name = "calendar_todo"
    description = "Manage deadlines, tasks, and to-do lists for graduate applications"

    def __init__(self):
        self.valid_priorities = ["high", "medium", "low"]
        self.valid_statuses = ["pending", "in_progress", "completed"]
        self.valid_categories = ["essay", "lor", "test_scores", "forms", "interview", "other"]

    def get_schema(self) -> Dict[str, Any]:
        """Return the JSON schema for this tool."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["add", "get", "list", "update", "delete", "complete",
                                "upcoming", "by_application", "stats", "create_template"],
                        "description": "The action to perform"
                    },
                    "task_id": {
                        "type": "integer",
                        "description": "Task ID (for get, update, delete, complete)"
                    },
                    "application_id": {
                        "type": "integer",
                        "description": "Associated application ID"
                    },
                    "title": {
                        "type": "string",
                        "description": "Task title"
                    },
                    "description": {
                        "type": "string",
                        "description": "Task description"
                    },
                    "due_date": {
                        "type": "string",
                        "description": "Due date (YYYY-MM-DD or YYYY-MM-DD HH:MM)"
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["high", "medium", "low"],
                        "description": "Task priority"
                    },
                    "category": {
                        "type": "string",
                        "enum": ["essay", "lor", "test_scores", "forms", "interview", "other"],
                        "description": "Task category"
                    },
                    "status": {
                        "type": "string",
                        "enum": ["pending", "in_progress", "completed"],
                        "description": "Task status"
                    },
                    "reminder_days": {
                        "type": "integer",
                        "description": "Days before due date to set reminder"
                    },
                    "days_ahead": {
                        "type": "integer",
                        "description": "Number of days to look ahead (for upcoming action)"
                    }
                },
                "required": ["action"]
            }
        }

    def execute(self, **kwargs) -> Dict[str, Any]:
        """Execute the tool with given parameters."""
        action = kwargs.get("action")

        actions = {
            "add": self._add_task,
            "get": self._get_task,
            "list": self._list_tasks,
            "update": self._update_task,
            "delete": self._delete_task,
            "complete": self._complete_task,
            "upcoming": self._get_upcoming,
            "by_application": self._get_by_application,
            "stats": self._get_stats,
            "create_template": self._create_template
        }

        if action in actions:
            return actions[action](**kwargs)
        else:
            return {"error": f"Unknown action: {action}"}

    def _add_task(self, **kwargs) -> Dict[str, Any]:
        """Add a new task."""
        title = kwargs.get("title")
        if not title:
            return {"error": "title is required"}

        # Calculate reminder date if reminder_days provided
        reminder_date = None
        due_date = kwargs.get("due_date")
        reminder_days = kwargs.get("reminder_days")

        if due_date and reminder_days:
            try:
                due_dt = datetime.strptime(due_date[:10], "%Y-%m-%d")
                reminder_dt = due_dt - timedelta(days=reminder_days)
                reminder_date = reminder_dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

        task_id = create_task(
            title=title,
            application_id=kwargs.get("application_id"),
            description=kwargs.get("description"),
            due_date=due_date,
            priority=kwargs.get("priority", "medium"),
            category=kwargs.get("category", "other"),
            reminder_date=reminder_date
        )

        return {
            "success": True,
            "task_id": task_id,
            "message": f"Created task: {title}",
            "reminder_set": reminder_date is not None
        }

    def _get_task(self, **kwargs) -> Dict[str, Any]:
        """Get a single task."""
        task_id = kwargs.get("task_id")
        if not task_id:
            return {"error": "task_id is required"}

        task = get_task(task_id)
        if not task:
            return {"error": f"Task with ID {task_id} not found"}

        # Add urgency indicator
        task["urgency"] = self._calculate_urgency(task.get("due_date"))

        return {"task": task}

    def _list_tasks(self, **kwargs) -> Dict[str, Any]:
        """List all tasks with optional status filter."""
        status = kwargs.get("status")

        if status:
            tasks = get_tasks_by_status(status)
        else:
            tasks = get_all_tasks()

        # Add urgency to each task
        for task in tasks:
            task["urgency"] = self._calculate_urgency(task.get("due_date"))

        # Group by status
        grouped = {s: [] for s in self.valid_statuses}
        for task in tasks:
            task_status = task.get("status", "pending")
            if task_status in grouped:
                grouped[task_status].append(task)

        return {
            "tasks": tasks,
            "count": len(tasks),
            "grouped": grouped
        }

    def _update_task(self, **kwargs) -> Dict[str, Any]:
        """Update an existing task."""
        task_id = kwargs.get("task_id")
        if not task_id:
            return {"error": "task_id is required"}

        updates = {}
        for field in ["title", "description", "due_date", "priority",
                      "status", "category", "reminder_date"]:
            if field in kwargs and kwargs[field] is not None:
                updates[field] = kwargs[field]

        if not updates:
            return {"error": "No update fields provided"}

        success = update_task(task_id, **updates)

        if not success:
            return {"error": f"Failed to update task {task_id}"}

        task = get_task(task_id)
        return {
            "success": True,
            "message": f"Updated task: {task.get('title', 'Unknown')}",
            "task": task
        }

    def _delete_task(self, **kwargs) -> Dict[str, Any]:
        """Delete a task."""
        task_id = kwargs.get("task_id")
        if not task_id:
            return {"error": "task_id is required"}

        task = get_task(task_id)
        if not task:
            return {"error": f"Task with ID {task_id} not found"}

        success = delete_task(task_id)

        if not success:
            return {"error": f"Failed to delete task {task_id}"}

        return {
            "success": True,
            "message": f"Deleted task: {task.get('title', 'Unknown')}"
        }

    def _complete_task(self, **kwargs) -> Dict[str, Any]:
        """Mark a task as completed."""
        task_id = kwargs.get("task_id")
        if not task_id:
            return {"error": "task_id is required"}

        task = get_task(task_id)
        if not task:
            return {"error": f"Task with ID {task_id} not found"}

        success = update_task(task_id, status="completed")

        if not success:
            return {"error": f"Failed to complete task {task_id}"}

        # Get stats for encouragement
        stats = get_task_stats()

        return {
            "success": True,
            "message": f"Completed: {task.get('title', 'Unknown')}",
            "celebration": self._get_celebration_message(stats)
        }

    def _get_upcoming(self, **kwargs) -> Dict[str, Any]:
        """Get upcoming tasks."""
        days = kwargs.get("days_ahead", 7)
        tasks = get_upcoming_tasks(days)

        # Categorize by urgency
        urgent = []  # Due in 3 days
        upcoming = []  # Due in 7 days
        planned = []  # Due later

        for task in tasks:
            urgency = self._calculate_urgency(task.get("due_date"))
            task["urgency"] = urgency

            if urgency == "urgent":
                urgent.append(task)
            elif urgency == "upcoming":
                upcoming.append(task)
            else:
                planned.append(task)

        return {
            "urgent": urgent,
            "upcoming": upcoming,
            "planned": planned,
            "total": len(tasks),
            "summary": self._generate_upcoming_summary(urgent, upcoming, planned)
        }

    def _get_by_application(self, **kwargs) -> Dict[str, Any]:
        """Get tasks for a specific application."""
        app_id = kwargs.get("application_id")
        if not app_id:
            return {"error": "application_id is required"}

        tasks = get_tasks_by_application(app_id)

        # Add urgency and calculate progress
        completed = 0
        for task in tasks:
            task["urgency"] = self._calculate_urgency(task.get("due_date"))
            if task.get("status") == "completed":
                completed += 1

        progress = (completed / len(tasks) * 100) if tasks else 0

        return {
            "tasks": tasks,
            "count": len(tasks),
            "completed": completed,
            "progress_percent": round(progress, 1)
        }

    def _get_stats(self, **kwargs) -> Dict[str, Any]:
        """Get task statistics."""
        stats = get_task_stats()

        # Get overdue count
        all_tasks = get_all_tasks()
        overdue = sum(1 for t in all_tasks
                     if t.get("status") != "completed"
                     and self._calculate_urgency(t.get("due_date")) == "overdue")

        stats["overdue"] = overdue

        return {
            "statistics": stats,
            "summary": self._generate_stats_summary(stats)
        }

    def _create_template(self, **kwargs) -> Dict[str, Any]:
        """Create a standard set of tasks for an application."""
        app_id = kwargs.get("application_id")
        if not app_id:
            return {"error": "application_id is required"}

        # Get application info
        apps = get_all_applications()
        app = next((a for a in apps if a["id"] == app_id), None)
        if not app:
            return {"error": f"Application {app_id} not found"}

        deadline = app.get("deadline")
        school = app.get("school_name", "Unknown")

        # Standard application tasks template
        template_tasks = [
            {"title": f"Research {school} program and faculty", "category": "other", "days_before": 60},
            {"title": f"Draft Statement of Purpose for {school}", "category": "essay", "days_before": 45},
            {"title": f"Request Letter of Recommendation 1", "category": "lor", "days_before": 30},
            {"title": f"Request Letter of Recommendation 2", "category": "lor", "days_before": 30},
            {"title": f"Request Letter of Recommendation 3", "category": "lor", "days_before": 30},
            {"title": f"Finalize SOP for {school}", "category": "essay", "days_before": 14},
            {"title": f"Submit test scores to {school}", "category": "test_scores", "days_before": 14},
            {"title": f"Complete {school} application form", "category": "forms", "days_before": 7},
            {"title": f"Final review and submit {school} application", "category": "forms", "days_before": 3},
        ]

        created_tasks = []
        for template in template_tasks:
            due_date = None
            if deadline:
                try:
                    deadline_dt = datetime.strptime(deadline[:10], "%Y-%m-%d")
                    due_dt = deadline_dt - timedelta(days=template["days_before"])
                    due_date = due_dt.strftime("%Y-%m-%d")
                except ValueError:
                    pass

            task_id = create_task(
                title=template["title"],
                application_id=app_id,
                due_date=due_date,
                priority="medium",
                category=template["category"]
            )
            created_tasks.append({
                "id": task_id,
                "title": template["title"],
                "due_date": due_date
            })

        return {
            "success": True,
            "tasks_created": len(created_tasks),
            "tasks": created_tasks,
            "message": f"Created {len(created_tasks)} tasks for {school} application"
        }

    def _calculate_urgency(self, due_date: Optional[str]) -> str:
        """Calculate task urgency based on due date."""
        if not due_date:
            return "planned"

        try:
            due_dt = datetime.strptime(due_date[:10], "%Y-%m-%d")
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            days_until = (due_dt - today).days

            if days_until < 0:
                return "overdue"
            elif days_until <= 3:
                return "urgent"
            elif days_until <= 7:
                return "upcoming"
            else:
                return "planned"
        except ValueError:
            return "planned"

    def _get_celebration_message(self, stats: Dict[str, Any]) -> str:
        """Generate a celebration message based on progress."""
        completed = stats.get("by_status", {}).get("completed", 0)
        total = stats.get("total", 0)

        if total == 0:
            return "Great start!"

        progress = completed / total

        if progress >= 1.0:
            return "All tasks completed! You're ready to submit!"
        elif progress >= 0.75:
            return "Almost there! Just a few more tasks to go!"
        elif progress >= 0.5:
            return "Halfway done! Keep up the great work!"
        elif progress >= 0.25:
            return "Making good progress! Stay focused!"
        else:
            return "Every task completed is a step closer to your goal!"

    def _generate_upcoming_summary(self, urgent: List, upcoming: List, planned: List) -> str:
        """Generate a summary of upcoming tasks."""
        parts = []

        if urgent:
            parts.append(f"{len(urgent)} urgent task(s) due within 3 days")
        if upcoming:
            parts.append(f"{len(upcoming)} task(s) due this week")
        if planned:
            parts.append(f"{len(planned)} task(s) scheduled ahead")

        if not parts:
            return "No upcoming tasks. Add some to stay organized!"

        return "; ".join(parts) + "."

    def _generate_stats_summary(self, stats: Dict[str, Any]) -> str:
        """Generate a summary of task statistics."""
        total = stats.get("total", 0)
        by_status = stats.get("by_status", {})
        urgent = stats.get("urgent", 0)
        overdue = stats.get("overdue", 0)

        if total == 0:
            return "No tasks yet. Create some to track your progress!"

        completed = by_status.get("completed", 0)
        pending = by_status.get("pending", 0)
        in_progress = by_status.get("in_progress", 0)

        parts = [f"Total: {total} tasks"]
        parts.append(f"Completed: {completed}")
        parts.append(f"In Progress: {in_progress}")
        parts.append(f"Pending: {pending}")

        if overdue > 0:
            parts.append(f"OVERDUE: {overdue}")
        if urgent > 0:
            parts.append(f"Urgent: {urgent}")

        return " | ".join(parts)


# Create singleton instance
calendar_todo_tool = CalendarTodoTool()
