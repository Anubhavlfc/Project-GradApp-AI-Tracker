"""
GradTrack AI - MCP Tools Package

This package contains the Model Context Protocol (MCP) tools
that the agent can invoke to perform actions.

Tools available:
- application_db: CRUD operations for applications
- program_research: Research graduate program information
- essay_analyzer: Analyze Statement of Purpose essays
- calendar_todo: Manage deadlines and to-do lists
"""

from .application_db import ApplicationDatabaseTool, get_tool_definition as get_app_db_def, create_tool as create_app_db
from .program_research import ProgramResearchTool, get_tool_definition as get_research_def, create_tool as create_research
from .essay_analyzer import EssayAnalyzerTool, get_tool_definition as get_essay_def, create_tool as create_essay
from .calendar_todo import CalendarTodoTool, get_tool_definition as get_calendar_def, create_tool as create_calendar

__all__ = [
    "ApplicationDatabaseTool",
    "ProgramResearchTool", 
    "EssayAnalyzerTool",
    "CalendarTodoTool",
    "get_all_tool_definitions",
    "create_all_tools"
]


def get_all_tool_definitions():
    """Get all tool definitions for the agent"""
    return [
        get_app_db_def(),
        get_research_def(),
        get_essay_def(),
        get_calendar_def()
    ]


def create_all_tools(db_manager):
    """Create instances of all tools with required dependencies"""
    return {
        "application_database": create_app_db(db_manager),
        "program_research": create_research(),
        "essay_analyzer": create_essay(),
        "calendar_todo": create_calendar(db_manager)
    }
