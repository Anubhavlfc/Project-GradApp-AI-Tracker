"""
MCP Tool: Application Database
Handles CRUD operations for graduate school applications.
"""

import sys
sys.path.insert(0, '../backend')

from typing import Dict, Any, List, Optional
from datetime import datetime
import json

# Import from backend database module
from backend.database import (
    create_application, get_application, get_all_applications,
    get_applications_by_status, update_application, delete_application,
    get_application_stats
)


class ApplicationDBTool:
    """
    MCP Tool for managing graduate school applications.
    Provides CRUD operations for the application database.
    """

    name = "application_database"
    description = "Manage graduate school applications - add, update, delete, and view applications"

    def __init__(self):
        self.valid_statuses = ["researching", "in_progress", "applied", "interview", "decision"]
        self.valid_decisions = ["pending", "accepted", "rejected", "waitlisted"]
        self.valid_degrees = ["MS", "PhD", "MBA", "MA", "MEng", "MFA", "MPH"]

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
                        "enum": ["add", "get", "list", "update", "delete", "stats"],
                        "description": "The action to perform"
                    },
                    "application_id": {
                        "type": "integer",
                        "description": "Application ID (for get, update, delete)"
                    },
                    "school_name": {
                        "type": "string",
                        "description": "Name of the university"
                    },
                    "program_name": {
                        "type": "string",
                        "description": "Name of the program"
                    },
                    "degree_type": {
                        "type": "string",
                        "enum": self.valid_degrees,
                        "description": "Type of degree"
                    },
                    "deadline": {
                        "type": "string",
                        "description": "Application deadline (YYYY-MM-DD)"
                    },
                    "status": {
                        "type": "string",
                        "enum": self.valid_statuses,
                        "description": "Application status"
                    },
                    "decision": {
                        "type": "string",
                        "enum": self.valid_decisions,
                        "description": "Decision result"
                    },
                    "notes": {
                        "type": "string",
                        "description": "Personal notes about the application"
                    },
                    "filter_status": {
                        "type": "string",
                        "enum": self.valid_statuses + ["all"],
                        "description": "Filter applications by status (for list action)"
                    }
                },
                "required": ["action"]
            }
        }

    def execute(self, **kwargs) -> Dict[str, Any]:
        """Execute the tool with given parameters."""
        action = kwargs.get("action")

        if action == "add":
            return self._add_application(**kwargs)
        elif action == "get":
            return self._get_application(**kwargs)
        elif action == "list":
            return self._list_applications(**kwargs)
        elif action == "update":
            return self._update_application(**kwargs)
        elif action == "delete":
            return self._delete_application(**kwargs)
        elif action == "stats":
            return self._get_stats()
        else:
            return {"error": f"Unknown action: {action}"}

    def _add_application(self, **kwargs) -> Dict[str, Any]:
        """Add a new application."""
        school_name = kwargs.get("school_name")
        program_name = kwargs.get("program_name")

        if not school_name or not program_name:
            return {"error": "school_name and program_name are required"}

        app_id = create_application(
            school_name=school_name,
            program_name=program_name,
            degree_type=kwargs.get("degree_type", "MS"),
            deadline=kwargs.get("deadline"),
            status=kwargs.get("status", "researching"),
            notes=kwargs.get("notes")
        )

        return {
            "success": True,
            "application_id": app_id,
            "message": f"Added {school_name} {program_name} to your application list",
            "status": "researching"
        }

    def _get_application(self, **kwargs) -> Dict[str, Any]:
        """Get a single application."""
        app_id = kwargs.get("application_id")
        if not app_id:
            return {"error": "application_id is required"}

        app = get_application(app_id)
        if not app:
            return {"error": f"Application with ID {app_id} not found"}

        return {"application": app}

    def _list_applications(self, **kwargs) -> Dict[str, Any]:
        """List applications with optional status filter."""
        filter_status = kwargs.get("filter_status", "all")

        if filter_status == "all":
            apps = get_all_applications()
        else:
            apps = get_applications_by_status(filter_status)

        # Group by status for Kanban view
        grouped = {}
        for status in self.valid_statuses:
            grouped[status] = [a for a in apps if a.get("status") == status]

        return {
            "applications": apps,
            "count": len(apps),
            "grouped": grouped
        }

    def _update_application(self, **kwargs) -> Dict[str, Any]:
        """Update an existing application."""
        app_id = kwargs.get("application_id")
        if not app_id:
            return {"error": "application_id is required"}

        updates = {}
        for field in ["school_name", "program_name", "degree_type",
                      "deadline", "status", "decision", "notes"]:
            if field in kwargs and kwargs[field] is not None:
                updates[field] = kwargs[field]

        if not updates:
            return {"error": "No update fields provided"}

        success = update_application(app_id, **updates)

        if not success:
            return {"error": f"Failed to update application {app_id}"}

        # Get updated application
        app = get_application(app_id)

        return {
            "success": True,
            "message": f"Updated application for {app.get('school_name', 'Unknown')}",
            "application": app
        }

    def _delete_application(self, **kwargs) -> Dict[str, Any]:
        """Delete an application."""
        app_id = kwargs.get("application_id")
        if not app_id:
            return {"error": "application_id is required"}

        # Get app info before deletion
        app = get_application(app_id)
        if not app:
            return {"error": f"Application with ID {app_id} not found"}

        success = delete_application(app_id)

        if not success:
            return {"error": f"Failed to delete application {app_id}"}

        return {
            "success": True,
            "message": f"Deleted application for {app.get('school_name', 'Unknown')} {app.get('program_name', '')}"
        }

    def _get_stats(self) -> Dict[str, Any]:
        """Get application statistics."""
        stats = get_application_stats()
        return {
            "statistics": stats,
            "summary": self._generate_summary(stats)
        }

    def _generate_summary(self, stats: Dict[str, Any]) -> str:
        """Generate a human-readable summary of statistics."""
        total = stats.get("total", 0)
        if total == 0:
            return "You haven't added any applications yet. Start by adding a school!"

        by_status = stats.get("by_status", {})
        by_decision = stats.get("by_decision", {})

        parts = [f"You have {total} applications total."]

        status_parts = []
        for status, count in by_status.items():
            if count > 0:
                status_parts.append(f"{count} {status}")
        if status_parts:
            parts.append("By status: " + ", ".join(status_parts) + ".")

        if by_decision:
            decision_parts = []
            for decision, count in by_decision.items():
                if count > 0:
                    decision_parts.append(f"{count} {decision}")
            if decision_parts:
                parts.append("Decisions: " + ", ".join(decision_parts) + ".")

        return " ".join(parts)


# Create singleton instance
application_db_tool = ApplicationDBTool()
