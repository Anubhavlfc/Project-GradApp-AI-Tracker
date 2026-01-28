"""
GradTrack AI - MCP Tools Package

This package contains the Model Context Protocol (MCP) tools
that the agent can invoke to perform actions.

Tools available:
- application_db: CRUD operations for applications
- program_research: Research graduate program information
- essay_analyzer: Analyze Statement of Purpose essays
- calendar_todo: Manage deadlines and to-do lists
- email_monitor: Auto-monitor email for application updates
- program_recommender: AI-powered program recommendations
- research_automation: Automate research for programs in researching bin
- decision_analyzer: Analyze decisions and provide feedback
"""

from .application_db import ApplicationDatabaseTool, get_tool_definition as get_app_db_def, create_tool as create_app_db
from .program_research import ProgramResearchTool, get_tool_definition as get_research_def, create_tool as create_research
from .essay_analyzer import EssayAnalyzerTool, get_tool_definition as get_essay_def, create_tool as create_essay
from .calendar_todo import CalendarTodoTool, get_tool_definition as get_calendar_def, create_tool as create_calendar
from .email_monitor import EmailMonitorTool, get_tool_definition as get_email_mon_def, create_tool as create_email_mon
from .program_recommender import ProgramRecommenderTool, get_tool_definition as get_recommender_def, create_tool as create_recommender
from .research_automation import ResearchAutomationTool, get_tool_definition as get_research_auto_def, create_tool as create_research_auto
from .decision_analyzer import DecisionAnalyzerTool, get_tool_definition as get_decision_def, create_tool as create_decision

__all__ = [
    "ApplicationDatabaseTool",
    "ProgramResearchTool",
    "EssayAnalyzerTool",
    "CalendarTodoTool",
    "EmailMonitorTool",
    "ProgramRecommenderTool",
    "ResearchAutomationTool",
    "DecisionAnalyzerTool",
    "get_all_tool_definitions",
    "create_all_tools"
]


def get_all_tool_definitions():
    """Get all tool definitions for the agent"""
    return [
        get_app_db_def(),
        get_research_def(),
        get_essay_def(),
        get_calendar_def(),
        get_email_mon_def(),
        get_recommender_def(),
        get_research_auto_def(),
        get_decision_def()
    ]


def create_all_tools(db_manager, email_service=None):
    """Create instances of all tools with required dependencies"""
    # Create program research tool first (needed by research automation)
    program_research_tool = create_research()

    tools = {
        "application_database": create_app_db(db_manager),
        "program_research": program_research_tool,
        "essay_analyzer": create_essay(),
        "calendar_todo": create_calendar(db_manager),
        "program_recommender": create_recommender(db_manager),
        "research_automation": create_research_auto(db_manager, program_research_tool),
        "decision_analyzer": create_decision(db_manager)
    }

    # Add email monitor only if email service is provided
    if email_service:
        tools["email_monitor"] = create_email_mon(db_manager, email_service)

    return tools
