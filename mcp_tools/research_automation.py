"""
GradTrack AI - Research Automation MCP Tool

This MCP tool automates and expedites the research process for programs
in the "researching" status. It helps users quickly gather information
about programs they're interested in.

Features:
- Auto-research program details (deadlines, requirements, funding)
- Batch research multiple programs at once
- Web search integration for up-to-date information
- Auto-populate application details
- Generate research summaries
- Track research progress

Tool Schema:
{
    "name": "research_automation",
    "description": "Automate program research for applications in researching stage",
    "parameters": {
        "action": "research_program | batch_research | get_summary | check_fit",
        "app_id": "Application ID to research",
        "auto_populate": "Automatically fill in researched data"
    }
}
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
import os
import json
from openai import OpenAI


class ResearchAutomationTool:
    """
    MCP Tool for automating graduate program research.

    This tool helps users in the "researching" phase by:
    - Automatically gathering program information
    - Checking deadlines and requirements
    - Analyzing program fit based on user profile
    - Batch researching multiple programs
    - Auto-populating application details

    Reduces manual research time from hours to minutes.
    """

    TOOL_NAME = "research_automation"
    TOOL_DESCRIPTION = """
    Automate research for graduate programs in your "researching" bin.

    Use this tool to:
    - Automatically research program details (deadlines, requirements, funding)
    - Batch research all programs in "researching" status
    - Check program fit based on your profile
    - Get comprehensive research summaries
    - Auto-populate application details with researched data

    Actions:
    - research_program: Research a specific program
    - batch_research: Research all programs in "researching" status
    - get_summary: Get a summary of research findings
    - check_fit: Analyze how well a program fits your profile
    - auto_populate: Automatically fill in details from research
    """

    TOOL_SCHEMA = {
        "name": "research_automation",
        "description": TOOL_DESCRIPTION,
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["research_program", "batch_research", "get_summary", "check_fit", "auto_populate"],
                    "description": "Action to perform"
                },
                "app_id": {
                    "type": "integer",
                    "description": "Application ID to research (for research_program, check_fit, auto_populate)"
                },
                "auto_update": {
                    "type": "boolean",
                    "description": "Automatically update application with researched data",
                    "default": True
                },
                "include_fit_analysis": {
                    "type": "boolean",
                    "description": "Include program fit analysis in research",
                    "default": True
                }
            },
            "required": ["action"]
        }
    }

    # Research data cache (in production, this would be a database)
    RESEARCH_CACHE = {}

    def __init__(self, db_manager, program_research_tool):
        """
        Initialize the research automation tool.

        Args:
            db_manager: DatabaseManager instance
            program_research_tool: ProgramResearchTool instance for looking up program info
        """
        self.db = db_manager
        self.program_research = program_research_tool

        # Initialize OpenAI client for AI-powered research summaries
        api_key = os.getenv('OPENROUTER_API_KEY') or os.getenv('OPENAI_API_KEY')
        if api_key:
            self.client = OpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1"
            )
        else:
            self.client = None

    def execute(self, **params) -> Dict[str, Any]:
        """Execute the research automation tool."""
        action = params.get("action")

        if not action:
            return self._error("Missing required parameter: action")

        # Route to appropriate handler
        handlers = {
            "research_program": self._research_program,
            "batch_research": self._batch_research,
            "get_summary": self._get_summary,
            "check_fit": self._check_fit,
            "auto_populate": self._auto_populate
        }

        handler = handlers.get(action)
        if not handler:
            return self._error(f"Unknown action: {action}")

        try:
            return handler(params)
        except Exception as e:
            return self._error(f"Error executing {action}: {str(e)}")

    def _research_program(self, params: Dict) -> Dict[str, Any]:
        """
        Research a specific program and gather comprehensive information.
        """
        app_id = params.get("app_id")
        auto_update = params.get("auto_update", True)

        if not app_id:
            return self._error("Missing required parameter: app_id")

        # Get the application
        app = self.db.get_application(app_id)
        if not app:
            return self._error(f"Application {app_id} not found")

        school = app.get("school_name")
        program = app.get("program_name")

        # Research the program using ProgramResearchTool
        research_result = self.program_research.execute(
            school=school,
            program=program,
            info_type="all"
        )

        if not research_result.get("success"):
            return self._error(f"Failed to research {school} - {program}")

        research_data = research_result.get("data", {})

        # Store in cache
        cache_key = f"{school}_{program}"
        self.RESEARCH_CACHE[cache_key] = {
            "timestamp": datetime.now().isoformat(),
            "data": research_data
        }

        # Auto-update application if requested
        updates_made = {}
        if auto_update and research_data.get("found"):
            # Update deadline if we found one
            if research_data.get("deadline_date") and not app.get("deadline"):
                updates_made["deadline"] = research_data["deadline_date"]

            # Add research summary to notes
            summary = self._generate_research_summary(research_data)
            existing_notes = app.get("notes", "")
            new_notes = f"{existing_notes}\n\n--- Auto-Research ({datetime.now().strftime('%Y-%m-%d')}) ---\n{summary}"
            updates_made["notes"] = new_notes

            # Apply updates
            if updates_made:
                self.db.update_application(app_id, updates_made)

        return self._success(
            message=f"Researched {school} - {program}",
            data={
                "app_id": app_id,
                "school": school,
                "program": program,
                "research": research_data,
                "auto_updated": auto_update,
                "updates_made": list(updates_made.keys()) if updates_made else []
            }
        )

    def _batch_research(self, params: Dict) -> Dict[str, Any]:
        """
        Research all programs in "researching" status.
        """
        auto_update = params.get("auto_update", True)

        # Get all applications in researching status
        researching_apps = self.db.get_applications_by_status("researching")

        if not researching_apps:
            return self._success(
                message="No applications in researching status",
                data={"researched": []}
            )

        # Research each program
        results = []
        for app in researching_apps:
            result = self._research_program({
                "app_id": app["id"],
                "auto_update": auto_update
            })

            if result.get("success"):
                results.append(result.get("data"))

        return self._success(
            message=f"Researched {len(results)} programs",
            data={
                "total_researched": len(results),
                "results": results
            }
        )

    def _get_summary(self, params: Dict) -> Dict[str, Any]:
        """
        Get a summary of research findings for all or specific programs.
        """
        app_id = params.get("app_id")

        if app_id:
            # Get summary for specific app
            app = self.db.get_application(app_id)
            if not app:
                return self._error(f"Application {app_id} not found")

            cache_key = f"{app['school_name']}_{app['program_name']}"
            cached = self.RESEARCH_CACHE.get(cache_key)

            if not cached:
                return self._error(f"No research data found for {app['school_name']}. Run research_program first.")

            return self._success(
                data={
                    "app_id": app_id,
                    "school": app["school_name"],
                    "program": app["program_name"],
                    "researched_at": cached["timestamp"],
                    "summary": self._generate_research_summary(cached["data"])
                }
            )
        else:
            # Get summary for all researched programs
            summaries = []
            for key, cached in self.RESEARCH_CACHE.items():
                summaries.append({
                    "program": key,
                    "researched_at": cached["timestamp"],
                    "summary": self._generate_research_summary(cached["data"])
                })

            return self._success(
                data={
                    "total_programs": len(summaries),
                    "summaries": summaries
                }
            )

    def _check_fit(self, params: Dict) -> Dict[str, Any]:
        """
        Analyze how well a program fits the user's profile.
        """
        app_id = params.get("app_id")

        if not app_id:
            return self._error("Missing required parameter: app_id")

        # Get the application
        app = self.db.get_application(app_id)
        if not app:
            return self._error(f"Application {app_id} not found")

        # Get user profile
        profile = self.db.get_user_profile()

        # Get research data
        cache_key = f"{app['school_name']}_{app['program_name']}"
        cached = self.RESEARCH_CACHE.get(cache_key)

        if not cached:
            # Research it first
            research_result = self._research_program({"app_id": app_id, "auto_update": False})
            if not research_result.get("success"):
                return research_result
            cached = self.RESEARCH_CACHE.get(cache_key)

        research_data = cached["data"]

        # Analyze fit
        fit_analysis = self._analyze_fit(profile, research_data)

        return self._success(
            message=f"Analyzed fit for {app['school_name']} - {app['program_name']}",
            data={
                "app_id": app_id,
                "school": app["school_name"],
                "program": app["program_name"],
                "fit_analysis": fit_analysis
            }
        )

    def _auto_populate(self, params: Dict) -> Dict[str, Any]:
        """
        Automatically populate application details from research data.
        """
        app_id = params.get("app_id")

        if not app_id:
            return self._error("Missing required parameter: app_id")

        # Get the application
        app = self.db.get_application(app_id)
        if not app:
            return self._error(f"Application {app_id} not found")

        # Get research data
        cache_key = f"{app['school_name']}_{app['program_name']}"
        cached = self.RESEARCH_CACHE.get(cache_key)

        if not cached:
            # Research it first
            research_result = self._research_program({"app_id": app_id, "auto_update": False})
            if not research_result.get("success"):
                return research_result
            cached = self.RESEARCH_CACHE.get(cache_key)

        research_data = cached["data"]

        # Populate fields
        updates = {}

        # Add deadline if found
        if research_data.get("deadline_date") and not app.get("deadline"):
            updates["deadline"] = research_data["deadline_date"]

        # Add comprehensive notes
        if research_data.get("found"):
            reqs = research_data.get("requirements", {})
            funding = research_data.get("funding", {})

            notes_parts = [
                app.get("notes", ""),
                f"\n--- Program Details (Auto-populated {datetime.now().strftime('%Y-%m-%d')}) ---"
            ]

            if research_data.get("deadline"):
                notes_parts.append(f"Deadline: {research_data['deadline']}")

            if reqs:
                notes_parts.append("\nRequirements:")
                if reqs.get("gre_required") is not None:
                    notes_parts.append(f"- GRE: {'Required' if reqs['gre_required'] else 'Optional'}")
                if reqs.get("toefl_minimum"):
                    notes_parts.append(f"- TOEFL: {reqs['toefl_minimum']} minimum")
                if reqs.get("gpa_recommended"):
                    notes_parts.append(f"- GPA: {reqs['gpa_recommended']} recommended")

            if funding:
                notes_parts.append("\nFunding:")
                if funding.get("funding_available"):
                    notes_parts.append(f"- Available: {', '.join(funding.get('funding_types', []))}")
                if funding.get("stipend_amount"):
                    notes_parts.append(f"- Stipend: ${funding['stipend_amount']:,}/year")

            if research_data.get("research_areas"):
                notes_parts.append(f"\nResearch Areas: {', '.join(research_data['research_areas'][:5])}")

            updates["notes"] = "\n".join(notes_parts)

        if updates:
            self.db.update_application(app_id, updates)

        return self._success(
            message=f"Auto-populated {len(updates)} fields for {app['school_name']}",
            data={
                "app_id": app_id,
                "populated_fields": list(updates.keys())
            }
        )

    def _generate_research_summary(self, research_data: Dict) -> str:
        """Generate a human-readable research summary."""
        if not research_data.get("found"):
            return "Program information not available in database."

        parts = []

        # Deadline
        if research_data.get("deadline"):
            parts.append(f"Deadline: {research_data['deadline']}")

        # Requirements
        reqs = research_data.get("requirements", {})
        if reqs:
            req_parts = []
            if reqs.get("gre_required") is not None:
                req_parts.append(f"GRE {'required' if reqs['gre_required'] else 'optional'}")
            if reqs.get("toefl_minimum"):
                req_parts.append(f"TOEFL {reqs['toefl_minimum']}+")
            if reqs.get("gpa_recommended"):
                req_parts.append(f"GPA {reqs['gpa_recommended']}+ recommended")
            if req_parts:
                parts.append("Requirements: " + ", ".join(req_parts))

        # Funding
        funding = research_data.get("funding", {})
        if funding.get("funding_available"):
            parts.append(f"Funding available ({', '.join(funding.get('funding_types', []))})")
            if funding.get("stipend_amount"):
                parts.append(f"Stipend: ${funding['stipend_amount']:,}/year")

        # Ranking
        ranking = research_data.get("ranking", {})
        if ranking.get("us_news_rank"):
            parts.append(f"US News Rank: #{ranking['us_news_rank']}")

        return " | ".join(parts) if parts else "Details available"

    def _analyze_fit(self, profile: Dict, research_data: Dict) -> Dict[str, Any]:
        """
        Analyze how well a program fits the user's profile.

        Returns a fit score and detailed analysis.
        """
        fit_score = 0
        max_score = 0
        feedback = []

        reqs = research_data.get("requirements", {})

        # Check GPA fit
        user_gpa = profile.get("gpa")
        rec_gpa = reqs.get("gpa_recommended")
        if user_gpa and rec_gpa:
            max_score += 25
            if user_gpa >= rec_gpa:
                fit_score += 25
                feedback.append(f"✓ Your GPA ({user_gpa}) meets/exceeds recommended ({rec_gpa})")
            elif user_gpa >= rec_gpa - 0.2:
                fit_score += 15
                feedback.append(f"~ Your GPA ({user_gpa}) is close to recommended ({rec_gpa})")
            else:
                feedback.append(f"✗ Your GPA ({user_gpa}) is below recommended ({rec_gpa})")

        # Check GRE fit
        user_gre_q = profile.get("gre_quant")
        if user_gre_q:
            max_score += 25
            if user_gre_q >= 165:
                fit_score += 25
                feedback.append(f"✓ Strong GRE Quant score ({user_gre_q})")
            elif user_gre_q >= 160:
                fit_score += 18
                feedback.append(f"~ Good GRE Quant score ({user_gre_q})")
            else:
                fit_score += 10
                feedback.append(f"✗ GRE Quant score ({user_gre_q}) could be stronger")

        # Check TOEFL fit (if international student)
        user_toefl = profile.get("toefl_score")
        min_toefl = reqs.get("toefl_minimum")
        if user_toefl and min_toefl:
            max_score += 20
            if user_toefl >= min_toefl:
                fit_score += 20
                feedback.append(f"✓ TOEFL score ({user_toefl}) meets minimum ({min_toefl})")
            else:
                feedback.append(f"✗ TOEFL score ({user_toefl}) below minimum ({min_toefl})")

        # Research interests match
        user_interests = profile.get("research_interests", "").lower()
        prog_areas = research_data.get("research_areas", [])
        if user_interests and prog_areas:
            max_score += 30
            matches = sum(1 for area in prog_areas if area.lower() in user_interests or user_interests in area.lower())
            if matches > 0:
                match_score = min(30, matches * 10)
                fit_score += match_score
                feedback.append(f"✓ Research interests align ({matches} matching areas)")
            else:
                feedback.append("~ Research interest alignment unclear")

        # Calculate percentage
        fit_percentage = int((fit_score / max_score * 100)) if max_score > 0 else 0

        # Determine tier
        if fit_percentage >= 80:
            tier = "safety"
            tier_desc = "Safety school - strong fit!"
        elif fit_percentage >= 60:
            tier = "match"
            tier_desc = "Match school - good fit"
        else:
            tier = "reach"
            tier_desc = "Reach school - competitive"

        return {
            "fit_score": fit_score,
            "max_score": max_score,
            "fit_percentage": fit_percentage,
            "tier": tier,
            "tier_description": tier_desc,
            "feedback": feedback,
            "recommendation": self._get_fit_recommendation(fit_percentage)
        }

    def _get_fit_recommendation(self, fit_percentage: int) -> str:
        """Get a recommendation based on fit percentage."""
        if fit_percentage >= 80:
            return "Strong candidate - definitely apply!"
        elif fit_percentage >= 60:
            return "Good fit - recommended to apply"
        elif fit_percentage >= 40:
            return "Moderate fit - worth applying but strengthen application"
        else:
            return "Consider if this is the right fit for your profile"

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
    return ResearchAutomationTool.TOOL_SCHEMA


def create_tool(db_manager, program_research_tool) -> ResearchAutomationTool:
    """Factory function to create the tool with dependencies"""
    return ResearchAutomationTool(db_manager, program_research_tool)
