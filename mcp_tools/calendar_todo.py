"""
GradTrack AI - Calendar & To-Do MCP Tool

This MCP tool helps manage deadlines and to-do items for grad applications.
Features:
- Create and manage tasks for each application
- View upcoming deadlines
- Set reminders
- Track task completion

Tool Schema:
{
    "name": "calendar_todo",
    "description": "Manage application deadlines and to-do lists",
    "parameters": {
        "action": "create_task | list_tasks | complete_task | delete_task | upcoming | by_application",
        "data": { ... action-specific parameters ... }
    }
}
"""

from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import json


class CalendarTodoTool:
    """
    MCP Tool for managing application deadlines and to-do items.
    
    This tool is invoked by the agent when a user:
    - Asks about upcoming deadlines
    - Wants to create a to-do list for an application
    - Needs to mark tasks as complete
    - Wants to see what's due soon
    
    All operations work with the tasks table in the database.
    """
    
    TOOL_NAME = "calendar_todo"
    TOOL_DESCRIPTION = """
    Manage deadlines and to-do lists for graduate school applications.
    Use this tool to:
    - Create new tasks for applications
    - List all tasks or filter by application/date
    - Mark tasks as complete
    - View upcoming deadlines
    - Get reminders for approaching deadlines
    
    Returns structured task data for the agent to communicate to the user.
    """
    
    TOOL_SCHEMA = {
        "name": "calendar_todo",
        "description": TOOL_DESCRIPTION,
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["create_task", "list_tasks", "complete_task", "delete_task", 
                             "upcoming", "by_application", "overdue"],
                    "description": "The action to perform"
                },
                "task_id": {
                    "type": "integer",
                    "description": "Task ID (for complete_task, delete_task)"
                },
                "application_id": {
                    "type": "integer",
                    "description": "Application ID to associate the task with"
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
                    "description": "Due date (YYYY-MM-DD format)"
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
                "days_ahead": {
                    "type": "integer",
                    "description": "Number of days to look ahead (for upcoming action)",
                    "default": 7
                }
            },
            "required": ["action"]
        }
    }
    
    # Category descriptions for user-friendly output
    CATEGORY_LABELS = {
        "essay": "📝 Essay/SOP",
        "lor": "✉️ Letter of Recommendation",
        "test_scores": "📊 Test Scores",
        "forms": "📋 Application Forms",
        "interview": "🎤 Interview Prep",
        "other": "📌 Other"
    }
    
    # Priority labels
    PRIORITY_LABELS = {
        "high": "🔴 High",
        "medium": "🟡 Medium", 
        "low": "🟢 Low"
    }
    
    def __init__(self, db_manager):
        """
        Initialize the tool with a database manager.
        
        Args:
            db_manager: Instance of DatabaseManager from database.py
        """
        self.db = db_manager
    
    def execute(self, **params) -> Dict[str, Any]:
        """
        Execute the tool with the given parameters.
        
        This is the main entry point called by the agent.
        """
        action = params.get("action")
        
        if not action:
            return self._error("Missing required parameter: action")
        
        # Route to appropriate handler
        handlers = {
            "create_task": self._create_task,
            "list_tasks": self._list_tasks,
            "complete_task": self._complete_task,
            "delete_task": self._delete_task,
            "upcoming": self._upcoming,
            "by_application": self._by_application,
            "overdue": self._overdue
        }
        
        handler = handlers.get(action)
        if not handler:
            return self._error(f"Unknown action: {action}")
        
        try:
            return handler(params)
        except Exception as e:
            return self._error(f"Error executing {action}: {str(e)}")
    
    def _create_task(self, params: Dict) -> Dict[str, Any]:
        """Create a new task"""
        title = params.get("title")
        if not title:
            return self._error("Missing required field: title")
        
        task_id = self.db.create_task(
            title=title,
            application_id=params.get("application_id"),
            description=params.get("description"),
            due_date=params.get("due_date"),
            priority=params.get("priority", "medium"),
            category=params.get("category", "other")
        )
        
        # Build response message
        msg = f"Created task: '{title}'"
        if params.get("due_date"):
            msg += f" (due: {params['due_date']})"
        
        return self._success(
            message=msg,
            data={"task_id": task_id, "title": title}
        )
    
    def _list_tasks(self, params: Dict) -> Dict[str, Any]:
        """List all tasks"""
        tasks = self.db.get_all_tasks()
        
        # Separate by status
        pending = [t for t in tasks if t["status"] == "pending"]
        in_progress = [t for t in tasks if t["status"] == "in_progress"]
        completed = [t for t in tasks if t["status"] == "completed"]
        
        # Add formatted labels
        for task in tasks:
            task["priority_label"] = self.PRIORITY_LABELS.get(task.get("priority"), "")
            task["category_label"] = self.CATEGORY_LABELS.get(task.get("category"), "")
        
        return self._success(
            message=f"Found {len(tasks)} tasks ({len(pending)} pending, {len(completed)} completed)",
            data={
                "tasks": tasks,
                "pending": pending,
                "in_progress": in_progress,
                "completed": completed,
                "total": len(tasks)
            }
        )
    
    def _complete_task(self, params: Dict) -> Dict[str, Any]:
        """Mark a task as complete"""
        task_id = params.get("task_id")
        if not task_id:
            return self._error("Missing required parameter: task_id")
        
        success = self.db.complete_task(task_id)
        if not success:
            return self._error(f"Task with ID {task_id} not found")
        
        return self._success(
            message=f"Task {task_id} marked as complete ✅",
            data={"task_id": task_id, "status": "completed"}
        )
    
    def _delete_task(self, params: Dict) -> Dict[str, Any]:
        """Delete a task"""
        task_id = params.get("task_id")
        if not task_id:
            return self._error("Missing required parameter: task_id")
        
        success = self.db.delete_task(task_id)
        if not success:
            return self._error(f"Task with ID {task_id} not found")
        
        return self._success(
            message=f"Task {task_id} deleted",
            data={"deleted_id": task_id}
        )
    
    def _upcoming(self, params: Dict) -> Dict[str, Any]:
        """Get upcoming tasks within the specified number of days"""
        days_ahead = params.get("days_ahead", 7)
        
        all_tasks = self.db.get_all_tasks()
        today = datetime.now().date()
        cutoff = today + timedelta(days=days_ahead)
        
        upcoming = []
        for task in all_tasks:
            if task.get("status") == "completed":
                continue
            
            due_date_str = task.get("due_date")
            if due_date_str:
                try:
                    due_date = datetime.strptime(due_date_str[:10], "%Y-%m-%d").date()
                    if today <= due_date <= cutoff:
                        # Calculate days until due
                        days_until = (due_date - today).days
                        task["days_until_due"] = days_until
                        task["urgency"] = "urgent" if days_until <= 3 else "upcoming"
                        upcoming.append(task)
                except ValueError:
                    continue
        
        # Sort by due date
        upcoming.sort(key=lambda x: x.get("due_date", ""))
        
        if upcoming:
            msg = f"Found {len(upcoming)} tasks due in the next {days_ahead} days"
        else:
            msg = f"No tasks due in the next {days_ahead} days"
        
        return self._success(
            message=msg,
            data={
                "upcoming_tasks": upcoming,
                "count": len(upcoming),
                "days_ahead": days_ahead
            }
        )
    
    def _by_application(self, params: Dict) -> Dict[str, Any]:
        """Get tasks for a specific application"""
        app_id = params.get("application_id")
        if not app_id:
            return self._error("Missing required parameter: application_id")
        
        all_tasks = self.db.get_all_tasks()
        app_tasks = [t for t in all_tasks if t.get("application_id") == app_id]
        
        pending = [t for t in app_tasks if t["status"] != "completed"]
        completed = [t for t in app_tasks if t["status"] == "completed"]
        
        # Get application name if available
        app = self.db.get_application(app_id)
        app_name = f"{app['school_name']} {app['program_name']}" if app else f"Application {app_id}"
        
        return self._success(
            message=f"Found {len(app_tasks)} tasks for {app_name}",
            data={
                "tasks": app_tasks,
                "pending": pending,
                "completed": completed,
                "application_name": app_name,
                "completion_rate": len(completed) / len(app_tasks) * 100 if app_tasks else 0
            }
        )
    
    def _overdue(self, params: Dict) -> Dict[str, Any]:
        """Get overdue tasks"""
        all_tasks = self.db.get_all_tasks()
        today = datetime.now().date()
        
        overdue = []
        for task in all_tasks:
            if task.get("status") == "completed":
                continue
            
            due_date_str = task.get("due_date")
            if due_date_str:
                try:
                    due_date = datetime.strptime(due_date_str[:10], "%Y-%m-%d").date()
                    if due_date < today:
                        days_overdue = (today - due_date).days
                        task["days_overdue"] = days_overdue
                        overdue.append(task)
                except ValueError:
                    continue
        
        # Sort by most overdue first
        overdue.sort(key=lambda x: x.get("days_overdue", 0), reverse=True)
        
        if overdue:
            msg = f"⚠️ You have {len(overdue)} overdue tasks!"
        else:
            msg = "✅ No overdue tasks"
        
        return self._success(
            message=msg,
            data={
                "overdue_tasks": overdue,
                "count": len(overdue)
            }
        )
    
    def _success(self, message: str = None, data: Any = None) -> Dict[str, Any]:
        """Create a success response"""
        response = {"success": True}
        if message:
            response["message"] = message
        if data is not None:
            response["data"] = data
        return response
    
    def _error(self, message: str) -> Dict[str, Any]:
        """Create an error response"""
        return {"success": False, "error": message}


# ============================================
# Tool Registration for Agent
# ============================================

def get_tool_definition() -> Dict:
    """Return the tool definition for the agent"""
    return CalendarTodoTool.TOOL_SCHEMA


def create_tool(db_manager) -> CalendarTodoTool:
    """Factory function to create the tool with dependencies"""
    return CalendarTodoTool(db_manager)
