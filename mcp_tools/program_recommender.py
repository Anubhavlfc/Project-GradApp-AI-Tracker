"""
GradTrack AI - Program Recommender MCP Tool

This MCP tool uses AI to recommend graduate programs based on the user's
existing applications, profile, and preferences.

Features:
- AI-powered program suggestions
- Similarity-based recommendations
- Considers user's profile (GPA, GRE, research interests)
- Analyzes application patterns
- Diversity recommendations (safety, match, reach schools)

Tool Schema:
{
    "name": "program_recommender",
    "description": "AI-powered graduate program recommendations",
    "parameters": {
        "action": "get_recommendations | analyze_profile | find_similar",
        "num_recommendations": "Number of programs to recommend (default: 5)",
        "focus": "safety | match | reach | all"
    }
}
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
import os
import json
from openai import OpenAI


class ProgramRecommenderTool:
    """
    MCP Tool for AI-powered program recommendations.

    This tool analyzes the user's:
    - Current applications (schools, programs, degree types)
    - Academic profile (GPA, GRE scores, research interests)
    - Application patterns and preferences

    Then recommends additional programs to apply to, categorized by:
    - Safety schools (high acceptance probability)
    - Match schools (good fit)
    - Reach schools (competitive but possible)
    """

    TOOL_NAME = "program_recommender"
    TOOL_DESCRIPTION = """
    Get AI-powered graduate program recommendations based on your profile and applications.

    Use this tool to:
    - Get personalized program recommendations
    - Discover programs similar to ones you're applying to
    - Analyze your application portfolio (safety/match/reach balance)
    - Find programs matching your research interests

    The AI analyzes your:
    - Existing applications
    - Academic credentials (GPA, test scores)
    - Research interests
    - Geographic preferences
    """

    TOOL_SCHEMA = {
        "name": "program_recommender",
        "description": TOOL_DESCRIPTION,
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["get_recommendations", "analyze_profile", "find_similar"],
                    "description": "Action to perform"
                },
                "num_recommendations": {
                    "type": "integer",
                    "description": "Number of programs to recommend",
                    "default": 5,
                    "minimum": 1,
                    "maximum": 20
                },
                "focus": {
                    "type": "string",
                    "enum": ["safety", "match", "reach", "all"],
                    "description": "Type of schools to recommend",
                    "default": "all"
                },
                "similar_to_school": {
                    "type": "string",
                    "description": "Find programs similar to this school (optional)"
                },
                "degree_type": {
                    "type": "string",
                    "enum": ["MS", "PhD", "MBA", "Any"],
                    "description": "Filter by degree type",
                    "default": "Any"
                }
            },
            "required": ["action"]
        }
    }

    # Comprehensive program database for recommendations
    PROGRAM_DATABASE = {
        "Safety": [
            {"school": "Arizona State University", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 45, "acceptance_rate": 0.45},
            {"school": "University of Massachusetts Amherst", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 25, "acceptance_rate": 0.40},
            {"school": "Northeastern University", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 35, "acceptance_rate": 0.42},
            {"school": "Rutgers University", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 40, "acceptance_rate": 0.43},
            {"school": "Stony Brook University", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 38, "acceptance_rate": 0.44},
        ],
        "Match": [
            {"school": "University of Southern California", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 20, "acceptance_rate": 0.25},
            {"school": "University of Maryland", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 16, "acceptance_rate": 0.28},
            {"school": "University of Wisconsin-Madison", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 18, "acceptance_rate": 0.27},
            {"school": "UT Austin", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 10, "acceptance_rate": 0.20},
            {"school": "University of Washington", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 6, "acceptance_rate": 0.15},
            {"school": "Georgia Tech", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 8, "acceptance_rate": 0.18},
            {"school": "UIUC", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 5, "acceptance_rate": 0.14},
        ],
        "Reach": [
            {"school": "MIT", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 1, "acceptance_rate": 0.08},
            {"school": "Stanford", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 1, "acceptance_rate": 0.07},
            {"school": "Carnegie Mellon", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 1, "acceptance_rate": 0.09},
            {"school": "UC Berkeley", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 1, "acceptance_rate": 0.08},
            {"school": "Princeton", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 7, "acceptance_rate": 0.10},
            {"school": "Cornell", "program": "Computer Science", "degree": ["MS", "PhD"], "rank": 6, "acceptance_rate": 0.12},
            {"school": "Caltech", "program": "Computer Science", "degree": ["PhD"], "rank": 11, "acceptance_rate": 0.11},
        ]
    }

    def __init__(self, db_manager):
        """
        Initialize the recommender tool.

        Args:
            db_manager: DatabaseManager instance for accessing applications and profile
        """
        self.db = db_manager

        # Initialize OpenAI client for AI recommendations
        api_key = os.getenv('OPENROUTER_API_KEY') or os.getenv('OPENAI_API_KEY')
        if api_key:
            self.client = OpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1"
            )
        else:
            self.client = None
            print("⚠️ No API key found for AI recommendations. Using rule-based recommendations.")

    def execute(self, **params) -> Dict[str, Any]:
        """Execute the recommender tool with given parameters."""
        action = params.get("action")

        if not action:
            return self._error("Missing required parameter: action")

        # Route to appropriate handler
        handlers = {
            "get_recommendations": self._get_recommendations,
            "analyze_profile": self._analyze_profile,
            "find_similar": self._find_similar
        }

        handler = handlers.get(action)
        if not handler:
            return self._error(f"Unknown action: {action}")

        try:
            return handler(params)
        except Exception as e:
            return self._error(f"Error executing {action}: {str(e)}")

    def _get_recommendations(self, params: Dict) -> Dict[str, Any]:
        """
        Get AI-powered program recommendations based on user's profile and applications.
        """
        num_recs = params.get("num_recommendations", 5)
        focus = params.get("focus", "all")
        degree_type = params.get("degree_type", "Any")

        # Get user's existing applications
        existing_apps = self.db.get_all_applications()

        # Get user profile
        profile = self.db.get_user_profile()

        # Use AI to generate recommendations if available
        if self.client:
            recommendations = self._ai_recommendations(
                existing_apps, profile, num_recs, focus, degree_type
            )
        else:
            recommendations = self._rule_based_recommendations(
                existing_apps, profile, num_recs, focus, degree_type
            )

        return self._success(
            message=f"Generated {len(recommendations)} program recommendations",
            data={
                "recommendations": recommendations,
                "based_on": {
                    "existing_applications": len(existing_apps),
                    "profile_complete": bool(profile.get("gpa") or profile.get("research_interests"))
                }
            }
        )

    def _analyze_profile(self, params: Dict) -> Dict[str, Any]:
        """
        Analyze the user's application portfolio and provide insights.
        """
        existing_apps = self.db.get_all_applications()
        profile = self.db.get_user_profile()

        # Count applications by status
        by_status = {}
        for app in existing_apps:
            status = app.get("status", "unknown")
            by_status[status] = by_status.get(status, 0) + 1

        # Analyze school tiers (if we can infer from existing apps)
        school_analysis = self._analyze_school_tiers(existing_apps)

        # Generate insights
        insights = []

        total_apps = len(existing_apps)
        if total_apps == 0:
            insights.append("You haven't added any applications yet. Start by adding some programs you're interested in!")
        elif total_apps < 5:
            insights.append(f"You have {total_apps} applications. Consider applying to 8-12 programs for a balanced portfolio.")
        elif total_apps > 15:
            insights.append(f"You have {total_apps} applications. That's quite a lot! Make sure you can dedicate enough time to each application.")

        # Tier balance insights
        if school_analysis.get("reach", 0) > school_analysis.get("safety", 0) + school_analysis.get("match", 0):
            insights.append("Your list is reach-heavy. Consider adding more safety and match schools.")
        elif school_analysis.get("safety", 0) == 0:
            insights.append("You don't have any safety schools. It's wise to include some safer options.")

        # Profile completeness
        if not profile.get("gpa"):
            insights.append("Add your GPA to get more accurate recommendations.")
        if not profile.get("research_interests"):
            insights.append("Add your research interests to find programs that match your goals.")

        return self._success(
            data={
                "total_applications": total_apps,
                "by_status": by_status,
                "school_tiers": school_analysis,
                "insights": insights,
                "profile_completeness": {
                    "gpa": bool(profile.get("gpa")),
                    "gre": bool(profile.get("gre_verbal") and profile.get("gre_quant")),
                    "research_interests": bool(profile.get("research_interests")),
                    "target_degree": bool(profile.get("target_degree"))
                }
            }
        )

    def _find_similar(self, params: Dict) -> Dict[str, Any]:
        """
        Find programs similar to a specified school.
        """
        similar_to = params.get("similar_to_school")
        num_recs = params.get("num_recommendations", 5)

        if not similar_to:
            return self._error("Missing required parameter: similar_to_school")

        # Find similar programs from our database
        similar_programs = []

        # Flatten all programs
        all_programs = []
        for tier, programs in self.PROGRAM_DATABASE.items():
            for prog in programs:
                prog["tier"] = tier
                all_programs.append(prog)

        # Simple similarity: same tier and close rank
        target_school = None
        similar_to_lower = similar_to.lower()

        # Find the target school
        for prog in all_programs:
            if similar_to_lower in prog["school"].lower():
                target_school = prog
                break

        if not target_school:
            return self._error(f"School '{similar_to}' not found in database")

        # Find similar schools (same tier, similar rank)
        target_rank = target_school["rank"]
        target_tier = target_school["tier"]

        for prog in all_programs:
            if prog["school"] == target_school["school"]:
                continue  # Skip the target school itself

            # Similar if same tier or rank within 10
            if prog["tier"] == target_tier or abs(prog["rank"] - target_rank) <= 10:
                similar_programs.append(prog)

        # Sort by rank similarity
        similar_programs.sort(key=lambda p: abs(p["rank"] - target_rank))

        # Limit to requested number
        similar_programs = similar_programs[:num_recs]

        return self._success(
            message=f"Found {len(similar_programs)} programs similar to {target_school['school']}",
            data={
                "similar_to": target_school,
                "recommendations": similar_programs
            }
        )

    def _ai_recommendations(self, existing_apps: List, profile: Dict,
                           num_recs: int, focus: str, degree_type: str) -> List[Dict]:
        """
        Use AI to generate personalized recommendations.
        """
        # Build context for AI
        apps_summary = "\n".join([
            f"- {app['school_name']} - {app['program_name']} ({app['degree_type']})"
            for app in existing_apps
        ])

        profile_summary = f"""
GPA: {profile.get('gpa', 'Not provided')}
GRE Verbal: {profile.get('gre_verbal', 'Not provided')}
GRE Quant: {profile.get('gre_quant', 'Not provided')}
Research Interests: {profile.get('research_interests', 'Not provided')}
Target Degree: {profile.get('target_degree', degree_type)}
Preferred Locations: {profile.get('preferred_locations', 'Not provided')}
"""

        prompt = f"""You are an expert graduate school admissions advisor.

Based on the student's profile and existing applications, recommend {num_recs} graduate programs they should consider.

STUDENT PROFILE:
{profile_summary}

CURRENT APPLICATIONS:
{apps_summary if apps_summary else "None yet"}

FOCUS: {focus} schools ({focus == 'safety' and 'higher acceptance rate' or focus == 'match' and 'good fit' or focus == 'reach' and 'competitive' or 'balanced mix'})

Provide recommendations in JSON format:
{{
  "recommendations": [
    {{
      "school": "University Name",
      "program": "Program Name",
      "degree": "MS/PhD",
      "tier": "safety/match/reach",
      "reasoning": "Why this is a good fit",
      "highlights": ["Key strength 1", "Key strength 2"]
    }}
  ]
}}

Focus on programs that:
1. Match the student's research interests
2. Are appropriate for their academic credentials
3. Provide a balanced application portfolio
4. Are different from their existing applications (avoid duplicates)
"""

        try:
            response = self.client.chat.completions.create(
                model="anthropic/claude-3.5-sonnet",
                messages=[
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000
            )

            result_text = response.choices[0].message.content.strip()

            # Parse JSON from response
            import re
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                return result.get("recommendations", [])
            else:
                # Fallback to rule-based
                return self._rule_based_recommendations(
                    existing_apps, profile, num_recs, focus, degree_type
                )

        except Exception as e:
            print(f"AI recommendation failed: {e}")
            return self._rule_based_recommendations(
                existing_apps, profile, num_recs, focus, degree_type
            )

    def _rule_based_recommendations(self, existing_apps: List, profile: Dict,
                                    num_recs: int, focus: str, degree_type: str) -> List[Dict]:
        """
        Generate recommendations using rules (fallback when AI unavailable).
        """
        # Get schools already applied to
        applied_schools = set([app.get("school_name", "").lower() for app in existing_apps])

        # Filter programs based on focus
        candidates = []

        if focus == "all":
            for tier, programs in self.PROGRAM_DATABASE.items():
                candidates.extend([{**p, "tier": tier} for p in programs])
        else:
            tier_map = {"safety": "Safety", "match": "Match", "reach": "Reach"}
            tier = tier_map.get(focus, "Match")
            candidates = [{**p, "tier": tier} for p in self.PROGRAM_DATABASE.get(tier, [])]

        # Filter out schools already applied to
        candidates = [
            p for p in candidates
            if p["school"].lower() not in applied_schools
        ]

        # Filter by degree type if specified
        if degree_type != "Any":
            candidates = [
                p for p in candidates
                if degree_type in p.get("degree", [])
            ]

        # Sort by rank (better schools first)
        candidates.sort(key=lambda p: p.get("rank", 999))

        # Take top N
        recommendations = candidates[:num_recs]

        # Add reasoning
        for rec in recommendations:
            rec["reasoning"] = f"Good {rec['tier'].lower()} option with strong {rec['program']} program"
            rec["highlights"] = [
                f"Ranked #{rec['rank']} in Computer Science",
                f"Acceptance rate: ~{int(rec['acceptance_rate'] * 100)}%"
            ]

        return recommendations

    def _analyze_school_tiers(self, applications: List[Dict]) -> Dict[str, int]:
        """
        Analyze the tier distribution of existing applications.
        """
        tiers = {"safety": 0, "match": 0, "reach": 0, "unknown": 0}

        # Simple heuristic based on school names
        reach_schools = {"mit", "stanford", "carnegie mellon", "berkeley", "cmu", "caltech", "princeton"}
        match_schools = {"georgia tech", "usc", "ut austin", "washington", "uiuc", "wisconsin", "maryland"}

        for app in applications:
            school_lower = app.get("school_name", "").lower()

            if any(reach in school_lower for reach in reach_schools):
                tiers["reach"] += 1
            elif any(match in school_lower for match in match_schools):
                tiers["match"] += 1
            elif school_lower:
                tiers["safety"] += 1
            else:
                tiers["unknown"] += 1

        return tiers

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
    return ProgramRecommenderTool.TOOL_SCHEMA


def create_tool(db_manager) -> ProgramRecommenderTool:
    """Factory function to create the tool with dependencies"""
    return ProgramRecommenderTool(db_manager)
