"""
GradTrack AI - Email Monitor MCP Tool

This MCP tool automatically monitors email for graduate application updates
and syncs them with the application database without manual intervention.

Features:
- Continuous email monitoring
- Auto-detection of application updates (interviews, decisions, deadlines)
- Auto-sync with database
- Smart duplicate detection
- Background processing

Tool Schema:
{
    "name": "email_monitor",
    "description": "Monitor email for application updates and auto-sync",
    "parameters": {
        "action": "start_monitor | check_now | get_status | sync_updates",
        "days_back": "Number of days to look back (default: 7)",
        "auto_import": "Whether to automatically import detected applications"
    }
}
"""

from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


class EmailMonitorTool:
    """
    MCP Tool for automated email monitoring and application sync.

    This tool enables the agent to:
    - Automatically check email for application updates
    - Detect new application emails (confirmations, interviews, decisions)
    - Auto-update existing applications with new status
    - Import new applications found in email
    - Run in background without user intervention

    Integration with email_service.py:
    - Uses EmailIntegrationService for Gmail access
    - Leverages AI email parsing
    - Smart duplicate detection
    """

    TOOL_NAME = "email_monitor"
    TOOL_DESCRIPTION = """
    Automatically monitor email for graduate application updates.

    Use this tool to:
    - Check email for new application updates
    - Auto-import applications from confirmation emails
    - Update application status based on interview invitations
    - Update decisions based on admission/rejection emails
    - Get monitoring status and recent sync results

    Actions:
    - check_now: Immediately scan email and sync updates
    - sync_updates: Sync detected applications with database
    - get_status: Get monitoring status and recent activity
    - get_recent_updates: Get applications detected in recent emails
    """

    TOOL_SCHEMA = {
        "name": "email_monitor",
        "description": TOOL_DESCRIPTION,
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["check_now", "sync_updates", "get_status", "get_recent_updates"],
                    "description": "Action to perform"
                },
                "days_back": {
                    "type": "integer",
                    "description": "Number of days to look back (default: 7)",
                    "default": 7,
                    "minimum": 1,
                    "maximum": 365
                },
                "auto_import": {
                    "type": "boolean",
                    "description": "Whether to automatically import new applications",
                    "default": True
                },
                "auto_update": {
                    "type": "boolean",
                    "description": "Whether to automatically update existing applications",
                    "default": True
                }
            },
            "required": ["action"]
        }
    }

    def __init__(self, db_manager, email_service):
        """
        Initialize the email monitor tool.

        Args:
            db_manager: DatabaseManager instance for application CRUD
            email_service: EmailIntegrationService instance for email access
        """
        self.db = db_manager
        self.email_service = email_service
        self.last_check_time = None
        self.last_sync_results = None

    def execute(self, **params) -> Dict[str, Any]:
        """
        Execute the email monitor tool with given parameters.

        Returns structured information about email sync and updates.
        """
        action = params.get("action")

        if not action:
            return self._error("Missing required parameter: action")

        # Route to appropriate handler
        handlers = {
            "check_now": self._check_now,
            "sync_updates": self._sync_updates,
            "get_status": self._get_status,
            "get_recent_updates": self._get_recent_updates
        }

        handler = handlers.get(action)
        if not handler:
            return self._error(f"Unknown action: {action}")

        try:
            return handler(params)
        except Exception as e:
            return self._error(f"Error executing {action}: {str(e)}")

    def _check_now(self, params: Dict) -> Dict[str, Any]:
        """
        Immediately check email for application updates.

        This scans the user's email, detects application-related emails,
        and returns what was found without importing yet.
        """
        days_back = params.get("days_back", 7)

        # Check if email service is authenticated
        if not self.email_service.gmail_service:
            return self._error(
                "Gmail not authenticated. Please authenticate first using /api/email/authenticate"
            )

        # Scan emails
        try:
            detected_apps = self.email_service.scan_for_applications(days_back=days_back)
            self.last_check_time = datetime.now()

            # Categorize detected applications
            new_apps = []
            updates = []

            existing_apps = self.db.get_all_applications()

            for app_data in detected_apps:
                # Check if this application already exists
                exists = self._find_matching_app(app_data, existing_apps)

                if exists:
                    # This is an update to existing application
                    update_info = self._determine_update(app_data, exists)
                    if update_info:
                        updates.append({
                            "app_id": exists["id"],
                            "school": app_data["school_name"],
                            "program": app_data["program_name"],
                            "update_type": app_data.get("email_type"),
                            "changes": update_info
                        })
                else:
                    # This is a new application
                    new_apps.append(app_data)

            return self._success(
                message=f"Found {len(new_apps)} new applications and {len(updates)} updates",
                data={
                    "checked_at": self.last_check_time.isoformat(),
                    "days_scanned": days_back,
                    "new_applications": new_apps,
                    "updates": updates,
                    "total_detected": len(detected_apps)
                }
            )

        except Exception as e:
            return self._error(f"Failed to check email: {str(e)}")

    def _sync_updates(self, params: Dict) -> Dict[str, Any]:
        """
        Sync detected email updates with the database.

        This imports new applications and updates existing ones based on
        emails found in the last check.
        """
        days_back = params.get("days_back", 7)
        auto_import = params.get("auto_import", True)
        auto_update = params.get("auto_update", True)

        # First, check email
        check_result = self._check_now({"days_back": days_back})

        if not check_result.get("success"):
            return check_result

        data = check_result["data"]
        new_apps = data.get("new_applications", [])
        updates = data.get("updates", [])

        imported_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []

        # Import new applications
        if auto_import:
            for app_data in new_apps:
                try:
                    app_id = self.db.create_application(
                        school_name=app_data["school_name"],
                        program_name=app_data["program_name"],
                        degree_type=app_data.get("degree_type", "Other"),
                        deadline=app_data.get("deadline"),
                        status=app_data.get("status", "researching"),
                        decision=app_data.get("decision"),
                        notes=app_data.get("notes", f"Auto-imported from email ({app_data.get('email_type')})")
                    )
                    imported_count += 1
                except Exception as e:
                    errors.append(f"Failed to import {app_data['school_name']}: {str(e)}")
        else:
            skipped_count += len(new_apps)

        # Update existing applications
        if auto_update:
            for update in updates:
                try:
                    success = self.db.update_application(
                        update["app_id"],
                        update["changes"]
                    )
                    if success:
                        updated_count += 1
                except Exception as e:
                    errors.append(f"Failed to update {update['school']}: {str(e)}")
        else:
            skipped_count += len(updates)

        # Store sync results
        self.last_sync_results = {
            "timestamp": datetime.now().isoformat(),
            "imported": imported_count,
            "updated": updated_count,
            "skipped": skipped_count,
            "errors": errors
        }

        return self._success(
            message=f"Synced {imported_count} new applications and {updated_count} updates",
            data=self.last_sync_results
        )

    def _get_status(self, params: Dict) -> Dict[str, Any]:
        """Get current monitoring status and last sync results."""
        return self._success(
            data={
                "authenticated": self.email_service.gmail_service is not None,
                "last_check": self.last_check_time.isoformat() if self.last_check_time else None,
                "last_sync_results": self.last_sync_results,
                "status": "active" if self.email_service.gmail_service else "not_authenticated"
            }
        )

    def _get_recent_updates(self, params: Dict) -> Dict[str, Any]:
        """Get applications detected in recent email checks."""
        if not self.last_sync_results:
            return self._success(
                message="No recent sync activity",
                data={"recent_updates": []}
            )

        return self._success(
            data={
                "last_sync": self.last_sync_results
            }
        )

    def _find_matching_app(self, email_app: Dict, existing_apps: List[Dict]) -> Optional[Dict]:
        """
        Find if an email-detected application matches an existing one.

        Matches based on school name and program name (fuzzy matching).
        """
        email_school = email_app.get("school_name", "").lower().strip()
        email_program = email_app.get("program_name", "").lower().strip()

        for app in existing_apps:
            app_school = app.get("school_name", "").lower().strip()
            app_program = app.get("program_name", "").lower().strip()

            # Exact match or close match
            if email_school in app_school or app_school in email_school:
                if email_program in app_program or app_program in email_program:
                    return app

        return None

    def _determine_update(self, email_app: Dict, existing_app: Dict) -> Optional[Dict]:
        """
        Determine what updates should be made to an existing application
        based on a new email about it.

        Returns a dict of fields to update, or None if no update needed.
        """
        updates = {}
        email_type = email_app.get("email_type")

        # Update status based on email type
        if email_type == "interview_invite":
            # Move to interview status if not already there
            if existing_app.get("status") not in ["interview", "decision"]:
                updates["status"] = "interview"

        elif email_type == "decision":
            # Move to decision status and set decision
            updates["status"] = "decision"
            if email_app.get("decision"):
                updates["decision"] = email_app["decision"]

        elif email_type == "confirmation" and existing_app.get("status") == "researching":
            # If we got a confirmation email, mark as applied
            updates["status"] = "applied"

        # Update deadline if email has one and we don't
        if email_app.get("deadline") and not existing_app.get("deadline"):
            updates["deadline"] = email_app["deadline"]

        # Append to notes
        if email_app.get("notes"):
            existing_notes = existing_app.get("notes", "")
            new_note = f"\n[Auto-detected from email - {datetime.now().strftime('%Y-%m-%d')}]: {email_app['notes']}"
            updates["notes"] = existing_notes + new_note

        return updates if updates else None

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
    return EmailMonitorTool.TOOL_SCHEMA


def create_tool(db_manager, email_service) -> EmailMonitorTool:
    """Factory function to create the tool with dependencies"""
    return EmailMonitorTool(db_manager, email_service)
