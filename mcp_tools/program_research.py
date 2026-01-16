"""
GradTrack AI - Program Research MCP Tool

This MCP tool allows the agent to research graduate programs.
It can fetch information about:
- Application deadlines
- Admission requirements (GRE, TOEFL, GPA)
- Tuition and funding options
- Program rankings
- Faculty and research areas

For this implementation, we use a mock database and optional web search.
In production, this could integrate with real APIs or web scraping.

Tool Schema:
{
    "name": "program_research",
    "description": "Research graduate program information",
    "parameters": {
        "school": "Name of the university",
        "program": "Name of the program",
        "info_type": "deadline | requirements | funding | ranking | faculty | all"
    }
}
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
import json
import os

# Optional: For real web search, we could use libraries like:
# - requests + BeautifulSoup for web scraping
# - serpapi for Google search
# - duckduckgo_search for DuckDuckGo search

class ProgramResearchTool:
    """
    MCP Tool for researching graduate program information.
    
    This tool is invoked by the agent when a user asks about:
    - "What's the deadline for MIT CS?"
    - "Does Stanford require GRE?"
    - "What's the tuition at Berkeley?"
    
    The tool returns structured information that the agent can
    use to formulate a helpful response.
    """
    
    TOOL_NAME = "program_research"
    TOOL_DESCRIPTION = """
    Research information about graduate programs at universities.
    Use this tool when the user asks about:
    - Application deadlines
    - Admission requirements (GRE, TOEFL, GPA minimums)
    - Tuition and funding opportunities
    - Program rankings
    - Faculty and research areas
    
    Returns structured data about the requested program.
    """
    
    TOOL_SCHEMA = {
        "name": "program_research",
        "description": TOOL_DESCRIPTION,
        "parameters": {
            "type": "object",
            "properties": {
                "school": {
                    "type": "string",
                    "description": "Name of the university (e.g., 'MIT', 'Stanford University')"
                },
                "program": {
                    "type": "string",
                    "description": "Name of the program (e.g., 'Computer Science', 'MS CS', 'PhD EECS')"
                },
                "degree_type": {
                    "type": "string",
                    "enum": ["MS", "PhD", "MBA", "Any"],
                    "description": "Type of degree to research"
                },
                "info_type": {
                    "type": "string",
                    "enum": ["deadline", "requirements", "funding", "ranking", "faculty", "all"],
                    "description": "Type of information to retrieve",
                    "default": "all"
                }
            },
            "required": ["school", "program"]
        }
    }
    
    # Mock database of program information
    # In production, this would be fetched from real sources
    PROGRAM_DATABASE = {
        "MIT": {
            "Computer Science": {
                "degree_types": ["MS", "PhD"],
                "deadline": "December 15",
                "deadline_date": "2025-12-15",
                "requirements": {
                    "gre_required": False,
                    "gre_recommended": True,
                    "toefl_minimum": 100,
                    "ielts_minimum": 7.0,
                    "gpa_minimum": None,
                    "gpa_recommended": 3.5,
                    "letters_required": 3
                },
                "funding": {
                    "tuition_per_year": 58240,
                    "funding_available": True,
                    "funding_types": ["RA", "TA", "Fellowship"],
                    "funding_coverage": "Full tuition + stipend for PhD",
                    "stipend_amount": 45000
                },
                "ranking": {
                    "us_news": 1,
                    "csrankings": 1
                },
                "faculty_areas": [
                    "Artificial Intelligence",
                    "Machine Learning", 
                    "Systems",
                    "Theory",
                    "Graphics",
                    "HCI",
                    "Robotics"
                ],
                "website": "https://www.eecs.mit.edu/academics/graduate-programs/"
            }
        },
        "Stanford": {
            "Computer Science": {
                "degree_types": ["MS", "PhD"],
                "deadline": "December 1",
                "deadline_date": "2025-12-01",
                "requirements": {
                    "gre_required": False,
                    "gre_recommended": False,
                    "toefl_minimum": 100,
                    "ielts_minimum": 7.0,
                    "gpa_minimum": None,
                    "gpa_recommended": 3.6,
                    "letters_required": 3
                },
                "funding": {
                    "tuition_per_year": 61731,
                    "funding_available": True,
                    "funding_types": ["RA", "TA", "Fellowship", "Knight-Hennessy"],
                    "funding_coverage": "Full tuition + stipend for PhD",
                    "stipend_amount": 50000
                },
                "ranking": {
                    "us_news": 1,
                    "csrankings": 2
                },
                "faculty_areas": [
                    "Artificial Intelligence",
                    "Machine Learning",
                    "NLP",
                    "Computer Vision",
                    "Systems",
                    "Theory",
                    "HCI"
                ],
                "website": "https://cs.stanford.edu/admissions/graduate"
            }
        },
        "Carnegie Mellon": {
            "Computer Science": {
                "degree_types": ["MS", "PhD"],
                "deadline": "December 10",
                "deadline_date": "2025-12-10",
                "requirements": {
                    "gre_required": False,
                    "gre_recommended": True,
                    "toefl_minimum": 100,
                    "ielts_minimum": 7.5,
                    "gpa_minimum": None,
                    "gpa_recommended": 3.5,
                    "letters_required": 3
                },
                "funding": {
                    "tuition_per_year": 52316,
                    "funding_available": True,
                    "funding_types": ["RA", "TA", "Fellowship"],
                    "funding_coverage": "Full tuition + stipend for PhD",
                    "stipend_amount": 43000
                },
                "ranking": {
                    "us_news": 1,
                    "csrankings": 3
                },
                "faculty_areas": [
                    "Machine Learning",
                    "Robotics",
                    "Computer Vision",
                    "NLP",
                    "Systems",
                    "Security",
                    "Human-Computer Interaction"
                ],
                "website": "https://www.cs.cmu.edu/academics/graduate-admissions"
            }
        },
        "UC Berkeley": {
            "Computer Science": {
                "degree_types": ["MS", "PhD"],
                "deadline": "December 15",
                "deadline_date": "2025-12-15",
                "requirements": {
                    "gre_required": False,
                    "gre_recommended": False,
                    "toefl_minimum": 90,
                    "ielts_minimum": 7.0,
                    "gpa_minimum": 3.0,
                    "gpa_recommended": 3.7,
                    "letters_required": 3
                },
                "funding": {
                    "tuition_per_year": 14312,  # In-state
                    "tuition_out_of_state": 29272,
                    "funding_available": True,
                    "funding_types": ["RA", "TA", "GSR", "Fellowship"],
                    "funding_coverage": "Full tuition + stipend for PhD",
                    "stipend_amount": 40000
                },
                "ranking": {
                    "us_news": 1,
                    "csrankings": 4
                },
                "faculty_areas": [
                    "Artificial Intelligence",
                    "Machine Learning",
                    "Systems",
                    "Security",
                    "Theory",
                    "Databases",
                    "Graphics"
                ],
                "website": "https://eecs.berkeley.edu/academics/graduate"
            }
        },
        "Georgia Tech": {
            "Computer Science": {
                "degree_types": ["MS", "PhD"],
                "deadline": "December 15",
                "deadline_date": "2025-12-15",
                "requirements": {
                    "gre_required": False,
                    "gre_recommended": True,
                    "toefl_minimum": 100,
                    "ielts_minimum": 7.5,
                    "gpa_minimum": 3.0,
                    "gpa_recommended": 3.5,
                    "letters_required": 3
                },
                "funding": {
                    "tuition_per_year": 13452,  # In-state
                    "tuition_out_of_state": 30698,
                    "funding_available": True,
                    "funding_types": ["RA", "TA", "GRA"],
                    "funding_coverage": "Full tuition + stipend for PhD",
                    "stipend_amount": 35000
                },
                "ranking": {
                    "us_news": 8,
                    "csrankings": 5
                },
                "faculty_areas": [
                    "Machine Learning",
                    "Robotics",
                    "Computer Vision",
                    "Systems",
                    "HCI",
                    "Computational Science"
                ],
                "website": "https://www.cc.gatech.edu/academics/graduate/admissions"
            }
        }
    }
    
    # School name aliases for better matching
    SCHOOL_ALIASES = {
        "mit": "MIT",
        "massachusetts institute of technology": "MIT",
        "stanford": "Stanford",
        "stanford university": "Stanford",
        "cmu": "Carnegie Mellon",
        "carnegie mellon": "Carnegie Mellon",
        "carnegie mellon university": "Carnegie Mellon",
        "berkeley": "UC Berkeley",
        "uc berkeley": "UC Berkeley",
        "cal": "UC Berkeley",
        "georgia tech": "Georgia Tech",
        "gatech": "Georgia Tech",
        "georgia institute of technology": "Georgia Tech"
    }
    
    # Program name aliases
    PROGRAM_ALIASES = {
        "cs": "Computer Science",
        "computer science": "Computer Science",
        "eecs": "Computer Science",
        "ms cs": "Computer Science",
        "phd cs": "Computer Science",
        "mscs": "Computer Science"
    }
    
    def __init__(self):
        pass
    
    def execute(self, **params) -> Dict[str, Any]:
        """
        Execute the research tool with given parameters.
        
        Returns structured information about the requested program.
        """
        school = params.get("school", "").strip()
        program = params.get("program", "").strip()
        info_type = params.get("info_type", "all")
        degree_type = params.get("degree_type", "Any")
        
        if not school:
            return self._error("Missing required parameter: school")
        if not program:
            return self._error("Missing required parameter: program")
        
        # Normalize school and program names
        school_normalized = self._normalize_school(school)
        program_normalized = self._normalize_program(program)
        
        # Look up program info
        program_info = self._get_program_info(school_normalized, program_normalized)
        
        if not program_info:
            # Program not in our database - return helpful message
            return self._not_found(school, program)
        
        # Filter by requested info type
        if info_type == "all":
            result = self._format_all_info(school_normalized, program_normalized, program_info)
        elif info_type == "deadline":
            result = self._format_deadline(school_normalized, program_normalized, program_info)
        elif info_type == "requirements":
            result = self._format_requirements(school_normalized, program_normalized, program_info)
        elif info_type == "funding":
            result = self._format_funding(school_normalized, program_normalized, program_info)
        elif info_type == "ranking":
            result = self._format_ranking(school_normalized, program_normalized, program_info)
        elif info_type == "faculty":
            result = self._format_faculty(school_normalized, program_normalized, program_info)
        else:
            return self._error(f"Unknown info_type: {info_type}")
        
        return self._success(data=result)
    
    def _normalize_school(self, school: str) -> str:
        """Normalize school name using aliases"""
        lower = school.lower()
        return self.SCHOOL_ALIASES.get(lower, school)
    
    def _normalize_program(self, program: str) -> str:
        """Normalize program name using aliases"""
        lower = program.lower()
        return self.PROGRAM_ALIASES.get(lower, program)
    
    def _get_program_info(self, school: str, program: str) -> Optional[Dict]:
        """Look up program info from database"""
        school_data = self.PROGRAM_DATABASE.get(school)
        if not school_data:
            return None
        return school_data.get(program)
    
    def _not_found(self, school: str, program: str) -> Dict[str, Any]:
        """Return a helpful not-found response"""
        return {
            "success": True,
            "found": False,
            "message": f"I don't have detailed information about {program} at {school} in my database.",
            "suggestion": "I can provide general guidance, or you can check the program's official website for accurate information.",
            "known_schools": list(self.PROGRAM_DATABASE.keys())
        }
    
    def _format_all_info(self, school: str, program: str, info: Dict) -> Dict:
        """Format all available information"""
        return {
            "found": True,
            "school": school,
            "program": program,
            "degree_types": info.get("degree_types", []),
            "deadline": info.get("deadline"),
            "deadline_date": info.get("deadline_date"),
            "requirements": info.get("requirements", {}),
            "funding": info.get("funding", {}),
            "ranking": info.get("ranking", {}),
            "faculty_areas": info.get("faculty_areas", []),
            "website": info.get("website")
        }
    
    def _format_deadline(self, school: str, program: str, info: Dict) -> Dict:
        """Format deadline information"""
        return {
            "found": True,
            "school": school,
            "program": program,
            "deadline": info.get("deadline"),
            "deadline_date": info.get("deadline_date"),
            "degree_types": info.get("degree_types", [])
        }
    
    def _format_requirements(self, school: str, program: str, info: Dict) -> Dict:
        """Format requirements information"""
        reqs = info.get("requirements", {})
        return {
            "found": True,
            "school": school,
            "program": program,
            "gre_required": reqs.get("gre_required"),
            "gre_recommended": reqs.get("gre_recommended"),
            "toefl_minimum": reqs.get("toefl_minimum"),
            "ielts_minimum": reqs.get("ielts_minimum"),
            "gpa_minimum": reqs.get("gpa_minimum"),
            "gpa_recommended": reqs.get("gpa_recommended"),
            "letters_required": reqs.get("letters_required")
        }
    
    def _format_funding(self, school: str, program: str, info: Dict) -> Dict:
        """Format funding information"""
        funding = info.get("funding", {})
        return {
            "found": True,
            "school": school,
            "program": program,
            "tuition_per_year": funding.get("tuition_per_year"),
            "funding_available": funding.get("funding_available"),
            "funding_types": funding.get("funding_types", []),
            "funding_coverage": funding.get("funding_coverage"),
            "stipend_amount": funding.get("stipend_amount")
        }
    
    def _format_ranking(self, school: str, program: str, info: Dict) -> Dict:
        """Format ranking information"""
        ranking = info.get("ranking", {})
        return {
            "found": True,
            "school": school,
            "program": program,
            "us_news_rank": ranking.get("us_news"),
            "csrankings_rank": ranking.get("csrankings")
        }
    
    def _format_faculty(self, school: str, program: str, info: Dict) -> Dict:
        """Format faculty/research areas information"""
        return {
            "found": True,
            "school": school,
            "program": program,
            "research_areas": info.get("faculty_areas", []),
            "website": info.get("website")
        }
    
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
    return ProgramResearchTool.TOOL_SCHEMA


def create_tool() -> ProgramResearchTool:
    """Factory function to create the tool"""
    return ProgramResearchTool()
