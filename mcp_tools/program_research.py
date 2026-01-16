"""
MCP Tool: Program Research
Searches for and provides information about graduate programs.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import re


class ProgramResearchTool:
    """
    MCP Tool for researching graduate programs.
    Provides information about deadlines, requirements, faculty, etc.
    """

    name = "program_research"
    description = "Research graduate programs - find deadlines, requirements, tuition, faculty, and rankings"

    def __init__(self):
        # Sample data for common programs (in production, this would call external APIs)
        self.program_data = {
            "MIT": {
                "Computer Science": {
                    "degree_types": ["PhD", "MEng"],
                    "deadline": "December 15",
                    "gre_required": False,
                    "toefl_minimum": 100,
                    "acceptance_rate": "~5%",
                    "tuition": "$57,986/year",
                    "notable_faculty": ["Tim Berners-Lee", "Barbara Liskov", "Daniela Rus"],
                    "research_areas": ["AI/ML", "Systems", "Theory", "Robotics", "HCI"]
                },
                "Electrical Engineering": {
                    "degree_types": ["PhD", "MEng", "SM"],
                    "deadline": "December 15",
                    "gre_required": False,
                    "toefl_minimum": 100,
                    "tuition": "$57,986/year"
                }
            },
            "Stanford": {
                "Computer Science": {
                    "degree_types": ["PhD", "MS"],
                    "deadline": "December 5",
                    "gre_required": False,
                    "toefl_minimum": 100,
                    "acceptance_rate": "~3%",
                    "tuition": "$56,169/year",
                    "notable_faculty": ["Fei-Fei Li", "Andrew Ng", "Christopher Manning"],
                    "research_areas": ["AI/ML", "NLP", "Computer Vision", "Systems", "Graphics"]
                }
            },
            "Berkeley": {
                "Computer Science": {
                    "degree_types": ["PhD", "MS"],
                    "deadline": "December 15",
                    "gre_required": False,
                    "toefl_minimum": 90,
                    "acceptance_rate": "~8%",
                    "tuition": "$14,312/year (in-state), $29,414/year (out-of-state)",
                    "notable_faculty": ["Michael Jordan", "Stuart Russell", "Dawn Song"],
                    "research_areas": ["AI/ML", "Systems", "Security", "Theory", "Graphics"]
                },
                "EECS": {
                    "degree_types": ["PhD", "MS"],
                    "deadline": "December 15",
                    "gre_required": False,
                    "toefl_minimum": 90
                }
            },
            "CMU": {
                "Computer Science": {
                    "degree_types": ["PhD", "MS"],
                    "deadline": "December 15",
                    "gre_required": False,
                    "toefl_minimum": 100,
                    "acceptance_rate": "~5%",
                    "tuition": "$50,000/year",
                    "notable_faculty": ["Tom Mitchell", "Manuela Veloso", "Tuomas Sandholm"],
                    "research_areas": ["AI/ML", "Robotics", "Systems", "NLP", "Computer Vision"]
                },
                "Machine Learning": {
                    "degree_types": ["PhD", "MS"],
                    "deadline": "December 1",
                    "gre_required": False,
                    "toefl_minimum": 100
                }
            },
            "Georgia Tech": {
                "Computer Science": {
                    "degree_types": ["PhD", "MS"],
                    "deadline": "December 15",
                    "gre_required": False,
                    "toefl_minimum": 100,
                    "acceptance_rate": "~15%",
                    "tuition": "$13,788/year (in-state), $29,140/year (out-of-state)",
                    "research_areas": ["AI/ML", "HCI", "Systems", "Robotics"]
                }
            }
        }

    def get_schema(self) -> Dict[str, Any]:
        """Return the JSON schema for this tool."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": {
                "type": "object",
                "properties": {
                    "school_name": {
                        "type": "string",
                        "description": "Name of the university (e.g., 'MIT', 'Stanford')"
                    },
                    "program_name": {
                        "type": "string",
                        "description": "Name of the program (e.g., 'Computer Science', 'EECS')"
                    },
                    "info_type": {
                        "type": "string",
                        "enum": ["all", "deadlines", "requirements", "tuition", "faculty", "rankings"],
                        "description": "Type of information to retrieve"
                    }
                },
                "required": ["school_name", "program_name"]
            }
        }

    def execute(self, **kwargs) -> Dict[str, Any]:
        """Execute the tool with given parameters."""
        school_name = kwargs.get("school_name", "").strip()
        program_name = kwargs.get("program_name", "").strip()
        info_type = kwargs.get("info_type", "all")

        if not school_name or not program_name:
            return {"error": "Both school_name and program_name are required"}

        # Normalize school name
        school_key = self._normalize_school_name(school_name)
        program_key = self._normalize_program_name(program_name)

        # Look up in our data
        if school_key in self.program_data:
            school_data = self.program_data[school_key]
            if program_key in school_data:
                program_data = school_data[program_key]
                return self._format_response(school_key, program_key, program_data, info_type)

        # If not found, return a helpful message with generic info
        return self._generate_generic_response(school_name, program_name, info_type)

    def _normalize_school_name(self, name: str) -> str:
        """Normalize school name for lookup."""
        name = name.lower().strip()

        mappings = {
            "massachusetts institute of technology": "MIT",
            "mit": "MIT",
            "stanford university": "Stanford",
            "stanford": "Stanford",
            "uc berkeley": "Berkeley",
            "berkeley": "Berkeley",
            "university of california berkeley": "Berkeley",
            "carnegie mellon": "CMU",
            "carnegie mellon university": "CMU",
            "cmu": "CMU",
            "georgia tech": "Georgia Tech",
            "georgia institute of technology": "Georgia Tech",
            "gatech": "Georgia Tech"
        }

        return mappings.get(name, name.title())

    def _normalize_program_name(self, name: str) -> str:
        """Normalize program name for lookup."""
        name = name.lower().strip()

        mappings = {
            "cs": "Computer Science",
            "computer science": "Computer Science",
            "eecs": "EECS",
            "ee": "Electrical Engineering",
            "electrical engineering": "Electrical Engineering",
            "ml": "Machine Learning",
            "machine learning": "Machine Learning"
        }

        return mappings.get(name, name.title())

    def _format_response(self, school: str, program: str,
                        data: Dict[str, Any], info_type: str) -> Dict[str, Any]:
        """Format the program data response."""
        result = {
            "school": school,
            "program": program,
            "found": True
        }

        if info_type == "all":
            result["details"] = data
            result["summary"] = self._generate_summary(school, program, data)
        elif info_type == "deadlines":
            result["deadline"] = data.get("deadline", "Not available")
            result["summary"] = f"The application deadline for {school} {program} is {data.get('deadline', 'not available')}."
        elif info_type == "requirements":
            result["requirements"] = {
                "gre_required": data.get("gre_required", "Unknown"),
                "toefl_minimum": data.get("toefl_minimum", "Unknown"),
                "degree_types": data.get("degree_types", [])
            }
        elif info_type == "tuition":
            result["tuition"] = data.get("tuition", "Not available")
        elif info_type == "faculty":
            result["faculty"] = data.get("notable_faculty", [])
            result["research_areas"] = data.get("research_areas", [])

        return result

    def _generate_summary(self, school: str, program: str, data: Dict[str, Any]) -> str:
        """Generate a human-readable summary."""
        parts = [f"{school} {program} Program:"]

        if data.get("deadline"):
            parts.append(f"- Application deadline: {data['deadline']}")

        if data.get("degree_types"):
            parts.append(f"- Offers: {', '.join(data['degree_types'])}")

        if "gre_required" in data:
            gre_status = "required" if data["gre_required"] else "not required"
            parts.append(f"- GRE: {gre_status}")

        if data.get("toefl_minimum"):
            parts.append(f"- TOEFL minimum: {data['toefl_minimum']}")

        if data.get("acceptance_rate"):
            parts.append(f"- Acceptance rate: {data['acceptance_rate']}")

        if data.get("tuition"):
            parts.append(f"- Tuition: {data['tuition']}")

        if data.get("notable_faculty"):
            parts.append(f"- Notable faculty: {', '.join(data['notable_faculty'][:3])}")

        if data.get("research_areas"):
            parts.append(f"- Research areas: {', '.join(data['research_areas'])}")

        return "\n".join(parts)

    def _generate_generic_response(self, school: str, program: str,
                                   info_type: str) -> Dict[str, Any]:
        """Generate a response when specific data isn't available."""
        return {
            "school": school,
            "program": program,
            "found": False,
            "message": f"I don't have specific data for {school} {program} in my database.",
            "suggestions": [
                f"Visit {school}'s official website for accurate deadline information",
                "Check GradCafe for application statistics and timelines",
                "Look at CSRankings.org for faculty and research areas",
                "Review the program's FAQ page for admission requirements"
            ],
            "general_tips": [
                "Most CS PhD programs have deadlines in December (1-15)",
                "Many top programs have made GRE optional since 2020",
                "TOEFL requirements typically range from 90-100",
                "Application fees usually range from $75-$125"
            ]
        }

    def search_by_criteria(self, **criteria) -> List[Dict[str, Any]]:
        """Search programs by criteria like deadline, GRE policy, etc."""
        results = []

        for school, programs in self.program_data.items():
            for program, data in programs.items():
                matches = True

                if "gre_required" in criteria:
                    if data.get("gre_required") != criteria["gre_required"]:
                        matches = False

                if "max_toefl" in criteria:
                    if data.get("toefl_minimum", 100) > criteria["max_toefl"]:
                        matches = False

                if "degree_type" in criteria:
                    if criteria["degree_type"] not in data.get("degree_types", []):
                        matches = False

                if matches:
                    results.append({
                        "school": school,
                        "program": program,
                        "details": data
                    })

        return results


# Create singleton instance
program_research_tool = ProgramResearchTool()
