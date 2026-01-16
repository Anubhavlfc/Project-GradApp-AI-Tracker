"""
GradTrack AI - Application Database MCP Tool

This MCP tool provides CRUD operations for graduate school applications.
The agent can invoke this tool to:
- Add new applications
- Update application status
- Query applications by various filters
- Delete applications
- Get statistics

Tool Schema:
{
    "name": "application_database",
    "description": "Manage graduate school applications - add, update, query, delete",
    "parameters": {
        "action": "create | read | update | delete | search | stats",
        "data": { ... action-specific parameters ... }
    }
}
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
import json

# We'll import the database manager when this is used
# This allows the tool to be tested independently


class ApplicationDatabaseTool:
    """
    MCP Tool for managing graduate school applications.
    
    This tool is invoked by the agent when it needs to:
    - Add a new school to the user's list
    - Update the status of an application
    - Check what applications exist
    - Get statistics about applications
    
    All operations return structured data that the agent can reason about.
    """
    
    # Tool metadata for the agent
    TOOL_NAME = "application_database"
    TOOL_DESCRIPTION = """
    Manage the user's graduate school applications database.
    Use this tool to add, update, query, or delete applications.
    
    Actions available:
    - create: Add a new application
    - read: Get application(s) by ID or get all
    - update: Update an existing application
    - delete: Remove an application
    - search: Search applications by school/program name
    - stats: Get statistics about all applications
    - by_status: Get applications filtered by status
    """
    
    TOOL_SCHEMA = {
        "name": "application_database",
        "description": TOOL_DESCRIPTION,
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["create", "read", "update", "delete", "search", "stats", "by_status"],
                    "description": "The action to perform"
                },
                "app_id": {
                    "type": "integer",
                    "description": "Application ID (for read, update, delete)"
                },
                "school_name": {
                    "type": "string",
                    "description": "Name of the university"
                },
                "program_name": {
                    "type": "string",
                    "description": "Name of the program (e.g., 'MS Computer Science')"
                },
                "degree_type": {
                    "type": "string",
                    "enum": ["MS", "PhD", "MBA", "MEng", "MA", "Other"],
                    "description": "Type of degree"
                },
                "deadline": {
                    "type": "string",
                    "description": "Application deadline (YYYY-MM-DD format)"
                },
                "status": {
                    "type": "string",
                    "enum": ["researching", "in_progress", "applied", "interview", "decision"],
                    "description": "Current application status"
                },
                "decision": {
                    "type": "string",
                    "enum": ["pending", "accepted", "rejected", "waitlisted"],
                    "description": "Decision status (if in decision stage)"
                },
                "notes": {
                    "type": "string",
                    "description": "Personal notes about this application"
                },
                "query": {
                    "type": "string",
                    "description": "Search query (for search action)"
                }
            },
            "required": ["action"]
        }
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
        Returns a structured response that the agent can interpret.
        """
        action = params.get("action")
        
        if not action:
            return self._error("Missing required parameter: action")
        
        # Route to appropriate handler
        handlers = {
            "create": self._create,
            "read": self._read,
            "update": self._update,
            "delete": self._delete,
            "search": self._search,
            "stats": self._stats,
            "by_status": self._by_status
        }
        
        handler = handlers.get(action)
        if not handler:
            return self._error(f"Unknown action: {action}")
        
        try:
            return handler(params)
        except Exception as e:
            return self._error(f"Error executing {action}: {str(e)}")
    
    def _create(self, params: Dict) -> Dict[str, Any]:
        """Create a new application"""
        required = ["school_name", "program_name", "degree_type"]
        for field in required:
            if not params.get(field):
                return self._error(f"Missing required field for create: {field}")
        
        app_id = self.db.create_application(
            school_name=params["school_name"],
            program_name=params["program_name"],
            degree_type=params["degree_type"],
            deadline=params.get("deadline"),
            status=params.get("status", "researching"),
            decision=params.get("decision"),
            notes=params.get("notes")
        )
        
        return self._success(
            message=f"Created application for {params['school_name']} {params['program_name']}",
            data={"id": app_id, "status": "researching"}
        )
    
    def _read(self, params: Dict) -> Dict[str, Any]:
        """Read application(s)"""
        app_id = params.get("app_id")
        
        if app_id:
            # Get specific application
            app = self.db.get_application(app_id)
            if not app:
                return self._error(f"Application with ID {app_id} not found")
            return self._success(data=app)
        else:
            # Get all applications
            apps = self.db.get_all_applications()
            return self._success(
                message=f"Found {len(apps)} applications",
                data={"applications": apps, "count": len(apps)}
            )
    
    def _update(self, params: Dict) -> Dict[str, Any]:
        """Update an existing application"""
        app_id = params.get("app_id")
        if not app_id:
            return self._error("Missing required parameter: app_id")
        
        # Extract update fields
        update_fields = {}
        for field in ["school_name", "program_name", "degree_type", "deadline", "status", "decision", "notes"]:
            if field in params and params[field] is not None:
                update_fields[field] = params[field]
        
        if not update_fields:
            return self._error("No fields to update")
        
        success = self.db.update_application(app_id, update_fields)
        if not success:
            return self._error(f"Application with ID {app_id} not found")
        
        return self._success(
            message=f"Updated application {app_id}",
            data={"id": app_id, "updated_fields": list(update_fields.keys())}
        )
    
    def _delete(self, params: Dict) -> Dict[str, Any]:
        """Delete an application"""
        app_id = params.get("app_id")
        if not app_id:
            return self._error("Missing required parameter: app_id")
        
        # Get app info before deleting for confirmation message
        app = self.db.get_application(app_id)
        if not app:
            return self._error(f"Application with ID {app_id} not found")
        
        success = self.db.delete_application(app_id)
        return self._success(
            message=f"Deleted application for {app['school_name']} {app['program_name']}",
            data={"deleted_id": app_id}
        )
    
    def _search(self, params: Dict) -> Dict[str, Any]:
        """Search applications by school/program name"""
        query = params.get("query")
        if not query:
            return self._error("Missing required parameter: query")
        
        apps = self.db.search_applications(query)
        return self._success(
            message=f"Found {len(apps)} applications matching '{query}'",
            data={"applications": apps, "count": len(apps)}
        )
    
    def _stats(self, params: Dict) -> Dict[str, Any]:
        """Get application statistics"""
        stats = self.db.get_application_stats()
        return self._success(
            message="Application statistics retrieved",
            data=stats
        )
    
    def _by_status(self, params: Dict) -> Dict[str, Any]:
        """Get applications by status"""
        status = params.get("status")
        if not status:
            return self._error("Missing required parameter: status")
        
        apps = self.db.get_applications_by_status(status)
        return self._success(
            message=f"Found {len(apps)} applications with status '{status}'",
            data={"applications": apps, "count": len(apps)}
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
    return ApplicationDatabaseTool.TOOL_SCHEMA


def create_tool(db_manager) -> ApplicationDatabaseTool:
    """Factory function to create the tool with dependencies"""
    return ApplicationDatabaseTool(db_manager)
