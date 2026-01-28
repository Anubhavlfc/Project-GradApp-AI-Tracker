"""
GradTrack AI - Decision Analyzer MCP Tool

This MCP tool provides feedback and analysis on application decisions
to help strengthen future applications.

Features:
- Analyze decisions (accepted/rejected/waitlisted)
- Identify patterns in successful vs unsuccessful applications
- Provide actionable feedback
- Suggest areas for improvement
- Track decision trends
- Generate insights for future cycles

Tool Schema:
{
    "name": "decision_analyzer",
    "description": "Analyze application decisions and provide feedback to strengthen applications",
    "parameters": {
        "action": "analyze_decision | get_patterns | get_insights | compare_decisions",
        "app_id": "Application ID to analyze"
    }
}
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
import os
import json
from openai import OpenAI


class DecisionAnalyzerTool:
    """
    MCP Tool for analyzing application decisions and providing actionable feedback.

    This tool helps users:
    - Understand why they got accepted or rejected
    - Identify patterns in their applications
    - Get personalized improvement recommendations
    - Compare successful vs unsuccessful applications
    - Learn from their application cycle

    The feedback feeds back into improving future applications.
    """

    TOOL_NAME = "decision_analyzer"
    TOOL_DESCRIPTION = """
    Analyze application decisions and get insights to strengthen future applications.

    Use this tool to:
    - Analyze individual decisions (accepted/rejected/waitlisted)
    - Identify patterns across all decisions
    - Get personalized improvement recommendations
    - Compare accepted vs rejected applications
    - Understand what worked and what didn't
    - Generate reports on your application cycle

    Actions:
    - analyze_decision: Deep analysis of a specific decision
    - get_patterns: Identify patterns across all decisions
    - get_insights: Get actionable insights and recommendations
    - compare_decisions: Compare accepted vs rejected applications
    - generate_report: Generate comprehensive application cycle report
    """

    TOOL_SCHEMA = {
        "name": "decision_analyzer",
        "description": TOOL_DESCRIPTION,
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["analyze_decision", "get_patterns", "get_insights", "compare_decisions", "generate_report"],
                    "description": "Action to perform"
                },
                "app_id": {
                    "type": "integer",
                    "description": "Application ID to analyze (for analyze_decision)"
                },
                "include_recommendations": {
                    "type": "boolean",
                    "description": "Include actionable recommendations in analysis",
                    "default": True
                }
            },
            "required": ["action"]
        }
    }

    def __init__(self, db_manager):
        """
        Initialize the decision analyzer tool.

        Args:
            db_manager: DatabaseManager instance for accessing applications and profile
        """
        self.db = db_manager

        # Initialize OpenAI client for AI-powered analysis
        api_key = os.getenv('OPENROUTER_API_KEY') or os.getenv('OPENAI_API_KEY')
        if api_key:
            self.client = OpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1"
            )
        else:
            self.client = None
            print("⚠️ No API key found for AI analysis. Using rule-based analysis.")

    def execute(self, **params) -> Dict[str, Any]:
        """Execute the decision analyzer tool."""
        action = params.get("action")

        if not action:
            return self._error("Missing required parameter: action")

        # Route to appropriate handler
        handlers = {
            "analyze_decision": self._analyze_decision,
            "get_patterns": self._get_patterns,
            "get_insights": self._get_insights,
            "compare_decisions": self._compare_decisions,
            "generate_report": self._generate_report
        }

        handler = handlers.get(action)
        if not handler:
            return self._error(f"Unknown action: {action}")

        try:
            return handler(params)
        except Exception as e:
            return self._error(f"Error executing {action}: {str(e)}")

    def _analyze_decision(self, params: Dict) -> Dict[str, Any]:
        """
        Analyze a specific application decision in detail.
        """
        app_id = params.get("app_id")
        include_recs = params.get("include_recommendations", True)

        if not app_id:
            return self._error("Missing required parameter: app_id")

        # Get the application
        app = self.db.get_application(app_id)
        if not app:
            return self._error(f"Application {app_id} not found")

        # Check if it has a decision
        if app.get("status") != "decision" or not app.get("decision"):
            return self._error("Application does not have a decision yet")

        decision = app.get("decision")
        school = app.get("school_name")
        program = app.get("program_name")

        # Get user profile for context
        profile = self.db.get_user_profile()

        # Use AI for deep analysis if available
        if self.client:
            analysis = self._ai_decision_analysis(app, profile, include_recs)
        else:
            analysis = self._rule_based_decision_analysis(app, profile, include_recs)

        return self._success(
            message=f"Analyzed decision for {school} - {program}",
            data={
                "app_id": app_id,
                "school": school,
                "program": program,
                "decision": decision,
                "analysis": analysis
            }
        )

    def _get_patterns(self, params: Dict) -> Dict[str, Any]:
        """
        Identify patterns across all application decisions.
        """
        # Get all applications with decisions
        all_apps = self.db.get_all_applications()
        decided_apps = [app for app in all_apps if app.get("status") == "decision" and app.get("decision")]

        if not decided_apps:
            return self._success(
                message="No decisions available yet to analyze patterns",
                data={"patterns": [], "total_decisions": 0}
            )

        # Categorize decisions
        accepted = [app for app in decided_apps if app.get("decision") == "accepted"]
        rejected = [app for app in decided_apps if app.get("decision") == "rejected"]
        waitlisted = [app for app in decided_apps if app.get("decision") == "waitlisted"]

        # Identify patterns
        patterns = []

        # Pattern 1: Acceptance rate by degree type
        degree_patterns = self._analyze_by_attribute(accepted, rejected, "degree_type")
        if degree_patterns:
            patterns.append({
                "type": "degree_type",
                "insight": degree_patterns,
                "pattern": "Success rate varies by degree type"
            })

        # Pattern 2: School tier patterns (if we can infer)
        tier_patterns = self._analyze_school_tiers(accepted, rejected)
        if tier_patterns:
            patterns.append({
                "type": "school_tier",
                "insight": tier_patterns,
                "pattern": "Performance differs across school tiers"
            })

        # Pattern 3: Timing patterns
        if any(app.get("notes") for app in decided_apps):
            patterns.append({
                "type": "application_quality",
                "insight": "Applications with detailed notes tend to be more successful",
                "recommendation": "Invest time in researching and documenting program fit"
            })

        return self._success(
            message=f"Identified {len(patterns)} patterns from {len(decided_apps)} decisions",
            data={
                "total_decisions": len(decided_apps),
                "accepted": len(accepted),
                "rejected": len(rejected),
                "waitlisted": len(waitlisted),
                "acceptance_rate": round(len(accepted) / len(decided_apps) * 100, 1),
                "patterns": patterns
            }
        )

    def _get_insights(self, params: Dict) -> Dict[str, Any]:
        """
        Get actionable insights and recommendations based on all decisions.
        """
        # Get all applications
        all_apps = self.db.get_all_applications()
        decided_apps = [app for app in all_apps if app.get("status") == "decision" and app.get("decision")]
        profile = self.db.get_user_profile()

        if not decided_apps:
            return self._success(
                message="Not enough decision data yet to generate insights",
                data={
                    "insights": [],
                    "recommendations": ["Continue applying to programs and check back after receiving decisions"]
                }
            )

        # Use AI for comprehensive insights
        if self.client:
            insights = self._ai_generate_insights(decided_apps, all_apps, profile)
        else:
            insights = self._rule_based_insights(decided_apps, all_apps, profile)

        return self._success(
            data={
                "total_decisions": len(decided_apps),
                "insights": insights.get("insights", []),
                "recommendations": insights.get("recommendations", []),
                "strengths": insights.get("strengths", []),
                "areas_for_improvement": insights.get("areas_for_improvement", [])
            }
        )

    def _compare_decisions(self, params: Dict) -> Dict[str, Any]:
        """
        Compare accepted vs rejected applications to identify success factors.
        """
        # Get all decided applications
        all_apps = self.db.get_all_applications()
        decided_apps = [app for app in all_apps if app.get("status") == "decision" and app.get("decision")]

        accepted = [app for app in decided_apps if app.get("decision") == "accepted"]
        rejected = [app for app in decided_apps if app.get("decision") == "rejected"]

        if not accepted or not rejected:
            return self._success(
                message="Need both acceptances and rejections to compare",
                data={"comparison": "Insufficient data for comparison"}
            )

        # Compare various attributes
        comparison = {
            "accepted_schools": [app["school_name"] for app in accepted],
            "rejected_schools": [app["school_name"] for app in rejected],
            "degree_type_distribution": {
                "accepted": self._get_distribution(accepted, "degree_type"),
                "rejected": self._get_distribution(rejected, "degree_type")
            },
            "note_length_avg": {
                "accepted": sum(len(app.get("notes", "")) for app in accepted) / len(accepted),
                "rejected": sum(len(app.get("notes", "")) for app in rejected) / len(rejected)
            }
        }

        # Generate comparative insights
        insights = []

        # Note length correlation
        if comparison["note_length_avg"]["accepted"] > comparison["note_length_avg"]["rejected"] * 1.5:
            insights.append("Accepted applications had significantly more detailed notes - research and preparation matter!")

        return self._success(
            data={
                "comparison": comparison,
                "insights": insights,
                "key_takeaway": self._generate_key_takeaway(accepted, rejected)
            }
        )

    def _generate_report(self, params: Dict) -> Dict[str, Any]:
        """
        Generate a comprehensive application cycle report.
        """
        all_apps = self.db.get_all_applications()
        decided_apps = [app for app in all_apps if app.get("status") == "decision" and app.get("decision")]
        profile = self.db.get_user_profile()

        # Get patterns
        patterns_result = self._get_patterns(params)
        patterns = patterns_result.get("data", {})

        # Get insights
        insights_result = self._get_insights(params)
        insights = insights_result.get("data", {})

        # Generate comprehensive report
        report = {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_applications": len(all_apps),
                "total_decisions": len(decided_apps),
                "accepted": len([a for a in decided_apps if a.get("decision") == "accepted"]),
                "rejected": len([a for a in decided_apps if a.get("decision") == "rejected"]),
                "waitlisted": len([a for a in decided_apps if a.get("decision") == "waitlisted"]),
                "pending": len([a for a in all_apps if a.get("status") != "decision"]),
            },
            "success_rate": round(len([a for a in decided_apps if a.get("decision") == "accepted"]) / len(decided_apps) * 100, 1) if decided_apps else 0,
            "patterns": patterns.get("patterns", []),
            "insights": insights.get("insights", []),
            "recommendations": insights.get("recommendations", []),
            "strengths": insights.get("strengths", []),
            "areas_for_improvement": insights.get("areas_for_improvement", []),
            "detailed_results": decided_apps
        }

        return self._success(
            message="Generated comprehensive application cycle report",
            data={"report": report}
        )

    # ============================================
    # Helper Methods
    # ============================================

    def _ai_decision_analysis(self, app: Dict, profile: Dict, include_recs: bool) -> Dict:
        """Use AI to analyze a specific decision."""
        decision = app.get("decision")
        school = app.get("school_name")
        program = app.get("program_name")

        prompt = f"""Analyze this graduate school application decision and provide insights.

APPLICATION:
School: {school}
Program: {program}
Degree: {app.get('degree_type')}
Decision: {decision}
Notes: {app.get('notes', 'No notes')}

APPLICANT PROFILE:
GPA: {profile.get('gpa', 'Not provided')}
GRE Verbal: {profile.get('gre_verbal', 'Not provided')}
GRE Quant: {profile.get('gre_quant', 'Not provided')}
Research Interests: {profile.get('research_interests', 'Not provided')}

Provide analysis in JSON format:
{{
  "likely_factors": ["Factor 1", "Factor 2"],
  "strengths_shown": ["Strength 1", "Strength 2"],
  "areas_for_improvement": ["Area 1", "Area 2"] (if rejected),
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "key_insight": "One sentence summary"
}}
"""

        try:
            response = self.client.chat.completions.create(
                model="anthropic/claude-3.5-sonnet",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1500
            )

            result_text = response.choices[0].message.content.strip()
            import re
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return self._rule_based_decision_analysis(app, profile, include_recs)
        except Exception as e:
            print(f"AI analysis failed: {e}")
            return self._rule_based_decision_analysis(app, profile, include_recs)

    def _rule_based_decision_analysis(self, app: Dict, profile: Dict, include_recs: bool) -> Dict:
        """Rule-based decision analysis fallback."""
        decision = app.get("decision")
        analysis = {
            "decision": decision,
            "likely_factors": [],
            "strengths_shown": [],
            "areas_for_improvement": [],
            "recommendations": []
        }

        if decision == "accepted":
            analysis["likely_factors"] = [
                "Strong academic profile",
                "Good program fit",
                "Well-prepared application"
            ]
            analysis["strengths_shown"] = [
                "Successfully demonstrated qualifications",
                "Met or exceeded program requirements"
            ]
            analysis["recommendations"] = [
                "Use this acceptance as a template for future applications",
                "Consider what made this application successful"
            ]

        elif decision == "rejected":
            analysis["likely_factors"] = [
                "Highly competitive program",
                "Large applicant pool",
                "Specific program requirements"
            ]
            analysis["areas_for_improvement"] = [
                "Consider strengthening academic credentials",
                "Research program fit more thoroughly",
                "Improve application materials"
            ]
            analysis["recommendations"] = [
                "Don't be discouraged - rejections are common",
                "Focus on programs that are a better fit",
                "Consider what you can improve for next cycle"
            ]

        elif decision == "waitlisted":
            analysis["likely_factors"] = [
                "Competitive candidate",
                "Program considering enrollment numbers",
                "Good fit but limited spots"
            ]
            analysis["recommendations"] = [
                "Send letter of continued interest",
                "Update program on new achievements",
                "Have backup options ready"
            ]

        return analysis

    def _ai_generate_insights(self, decided_apps: List, all_apps: List, profile: Dict) -> Dict:
        """Use AI to generate comprehensive insights."""
        accepted = [app for app in decided_apps if app.get("decision") == "accepted"]
        rejected = [app for app in decided_apps if app.get("decision") == "rejected"]

        accepted_summary = ", ".join([f"{app['school_name']} ({app['degree_type']})" for app in accepted])
        rejected_summary = ", ".join([f"{app['school_name']} ({app['degree_type']})" for app in rejected])

        prompt = f"""Analyze this graduate application cycle and provide actionable insights.

RESULTS:
Accepted: {accepted_summary or 'None'}
Rejected: {rejected_summary or 'None'}
Total Applications: {len(all_apps)}

PROFILE:
GPA: {profile.get('gpa', 'Not provided')}
GRE: V{profile.get('gre_verbal', '?')} Q{profile.get('gre_quant', '?')}
Research: {profile.get('research_interests', 'Not provided')}

Provide insights in JSON format:
{{
  "insights": ["Insight 1", "Insight 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "strengths": ["Strength 1", "Strength 2"],
  "areas_for_improvement": ["Area 1", "Area 2"]
}}
"""

        try:
            response = self.client.chat.completions.create(
                model="anthropic/claude-3.5-sonnet",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1500
            )

            result_text = response.choices[0].message.content.strip()
            import re
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return self._rule_based_insights(decided_apps, all_apps, profile)
        except Exception as e:
            print(f"AI insights failed: {e}")
            return self._rule_based_insights(decided_apps, all_apps, profile)

    def _rule_based_insights(self, decided_apps: List, all_apps: List, profile: Dict) -> Dict:
        """Rule-based insights fallback."""
        accepted = [app for app in decided_apps if app.get("decision") == "accepted"]
        rejected = [app for app in decided_apps if app.get("decision") == "rejected"]

        acceptance_rate = len(accepted) / len(decided_apps) * 100 if decided_apps else 0

        insights = {
            "insights": [],
            "recommendations": [],
            "strengths": [],
            "areas_for_improvement": []
        }

        # Acceptance rate insights
        if acceptance_rate >= 50:
            insights["insights"].append(f"Strong cycle with {acceptance_rate:.0f}% acceptance rate")
            insights["strengths"].append("Well-targeted school selection")
        elif acceptance_rate >= 25:
            insights["insights"].append(f"Moderate success with {acceptance_rate:.0f}% acceptance rate")
        else:
            insights["insights"].append(f"Challenging cycle with {acceptance_rate:.0f}% acceptance rate")
            insights["areas_for_improvement"].append("Consider more safety/match schools")

        # General recommendations
        insights["recommendations"].extend([
            "Continue refining your application materials",
            "Research programs thoroughly for fit",
            "Build relationships with potential advisors"
        ])

        return insights

    def _analyze_by_attribute(self, accepted: List, rejected: List, attribute: str) -> Optional[str]:
        """Analyze pattern by a specific attribute."""
        if not accepted or not rejected:
            return None

        accepted_dist = self._get_distribution(accepted, attribute)
        rejected_dist = self._get_distribution(rejected, attribute)

        # Find significant differences
        for key in set(list(accepted_dist.keys()) + list(rejected_dist.keys())):
            acc_rate = accepted_dist.get(key, 0)
            rej_rate = rejected_dist.get(key, 0)
            if acc_rate > rej_rate * 2:
                return f"Higher success rate for {attribute}: {key}"

        return None

    def _get_distribution(self, apps: List, attribute: str) -> Dict:
        """Get distribution of an attribute across apps."""
        dist = {}
        for app in apps:
            value = app.get(attribute, "Unknown")
            dist[value] = dist.get(value, 0) + 1
        return dist

    def _analyze_school_tiers(self, accepted: List, rejected: List) -> Optional[str]:
        """Analyze success rate by school tier."""
        reach_schools = {"mit", "stanford", "carnegie mellon", "berkeley", "cmu", "caltech", "princeton", "cornell"}

        accepted_reach = sum(1 for app in accepted if any(r in app.get("school_name", "").lower() for r in reach_schools))
        rejected_reach = sum(1 for app in rejected if any(r in app.get("school_name", "").lower() for r in reach_schools))

        if accepted_reach > 0:
            return f"Successfully gained admission to reach schools"
        elif rejected_reach > len(rejected) / 2:
            return "Most rejections from reach schools - consider more match/safety options"

        return None

    def _generate_key_takeaway(self, accepted: List, rejected: List) -> str:
        """Generate a key takeaway from the comparison."""
        if len(accepted) > len(rejected):
            return "Your application strategy was successful - good school targeting and preparation"
        elif len(rejected) > len(accepted) * 2:
            return "Consider applying to more safety/match schools and strengthening your profile"
        else:
            return "Balanced results - continue refining your application approach"

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
    return DecisionAnalyzerTool.TOOL_SCHEMA


def create_tool(db_manager) -> DecisionAnalyzerTool:
    """Factory function to create the tool with dependencies"""
    return DecisionAnalyzerTool(db_manager)
