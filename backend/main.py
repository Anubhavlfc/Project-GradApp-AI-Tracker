"""
FastAPI server for GradTrack AI.
Provides REST API endpoints for the frontend.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import uvicorn

from database import (
    create_application, get_application, get_all_applications,
    get_applications_by_status, update_application, delete_application,
    create_task, get_task, get_all_tasks, get_tasks_by_application,
    get_tasks_by_status, get_upcoming_tasks, update_task, delete_task,
    get_user_profile, update_user_profile, save_essay, get_latest_essay,
    save_interview_notes, get_interview_notes, get_application_stats,
    get_task_stats
)
from memory import (
    store_conversation, search_conversations, get_memory_stats,
    store_essay as store_essay_memory, search_essays
)
from agent import get_agent, reset_agent


# Initialize FastAPI app
app = FastAPI(
    title="GradTrack AI",
    description="AI-powered graduate school application tracker",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for request/response
class ApplicationCreate(BaseModel):
    school_name: str
    program_name: str
    degree_type: str = "MS"
    deadline: Optional[str] = None
    status: str = "researching"
    notes: Optional[str] = None


class ApplicationUpdate(BaseModel):
    school_name: Optional[str] = None
    program_name: Optional[str] = None
    degree_type: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[str] = None
    decision: Optional[str] = None
    notes: Optional[str] = None


class TaskCreate(BaseModel):
    title: str
    application_id: Optional[int] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    priority: str = "medium"
    category: str = "other"
    reminder_date: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    reminder_date: Optional[str] = None


class ChatMessage(BaseModel):
    message: str


class ProfileUpdate(BaseModel):
    gpa: Optional[float] = None
    gre_verbal: Optional[int] = None
    gre_quant: Optional[int] = None
    gre_writing: Optional[float] = None
    major: Optional[str] = None
    research_interests: Optional[str] = None
    preferred_locations: Optional[str] = None
    undergraduate_school: Optional[str] = None
    work_experience: Optional[str] = None


class EssaySave(BaseModel):
    application_id: int
    content: str
    essay_type: str = "sop"


class InterviewNotes(BaseModel):
    application_id: int
    interview_date: Optional[str] = None
    interviewer_name: Optional[str] = None
    notes: Optional[str] = None
    questions_asked: Optional[str] = None
    follow_up_items: Optional[str] = None


# Tool handlers for the agent
def tool_add_application(school_name: str, program_name: str,
                         degree_type: str = "MS", deadline: str = None,
                         notes: str = None) -> Dict[str, Any]:
    app_id = create_application(school_name, program_name, degree_type, deadline, "researching", notes)
    return {"success": True, "application_id": app_id, "message": f"Added {school_name} {program_name} to your list"}


def tool_update_application_status(application_id: int, status: str,
                                   decision: str = None) -> Dict[str, Any]:
    updates = {"status": status}
    if decision:
        updates["decision"] = decision
    success = update_application(application_id, **updates)
    return {"success": success, "message": f"Updated application status to {status}"}


def tool_get_applications(status: str = "all") -> Dict[str, Any]:
    if status == "all":
        apps = get_all_applications()
    else:
        apps = get_applications_by_status(status)
    return {"applications": apps, "count": len(apps)}


def tool_add_task(title: str, application_id: int = None, due_date: str = None,
                  priority: str = "medium", category: str = "other") -> Dict[str, Any]:
    task_id = create_task(title, application_id, None, due_date, priority, category)
    return {"success": True, "task_id": task_id, "message": f"Added task: {title}"}


def tool_complete_task(task_id: int) -> Dict[str, Any]:
    success = update_task(task_id, status="completed")
    return {"success": success, "message": "Task marked as completed"}


def tool_get_upcoming_deadlines(days: int = 7) -> Dict[str, Any]:
    tasks = get_upcoming_tasks(days)
    return {"tasks": tasks, "count": len(tasks)}


def tool_research_program(school_name: str, program_name: str,
                          info_type: str = "all") -> Dict[str, Any]:
    # This would typically call an external API or web search
    # For now, return a placeholder
    return {
        "school_name": school_name,
        "program_name": program_name,
        "message": f"Research information for {school_name} {program_name} would be fetched here",
        "note": "Connect to web search API for real-time data"
    }


def tool_analyze_essay(essay_content: str, school_name: str = None,
                       program_name: str = None) -> Dict[str, Any]:
    word_count = len(essay_content.split())
    char_count = len(essay_content)
    paragraph_count = len([p for p in essay_content.split('\n\n') if p.strip()])

    return {
        "word_count": word_count,
        "character_count": char_count,
        "paragraph_count": paragraph_count,
        "analysis": "Essay analysis would be performed here with detailed feedback",
        "suggestions": [
            "Consider adding specific faculty names",
            "Strengthen your research motivation section",
            "Add more concrete examples of your experience"
        ]
    }


def tool_update_profile(**kwargs) -> Dict[str, Any]:
    profile_id = update_user_profile(**kwargs)
    return {"success": True, "profile_id": profile_id, "message": "Profile updated successfully"}


# Initialize agent with tool handlers
TOOL_HANDLERS = {
    "add_application": tool_add_application,
    "update_application_status": tool_update_application_status,
    "get_applications": tool_get_applications,
    "add_task": tool_add_task,
    "complete_task": tool_complete_task,
    "get_upcoming_deadlines": tool_get_upcoming_deadlines,
    "research_program": tool_research_program,
    "analyze_essay": tool_analyze_essay,
    "update_profile": tool_update_profile,
}


# API Routes

@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Welcome to GradTrack AI", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


# Application endpoints
@app.post("/api/applications")
async def create_new_application(application: ApplicationCreate):
    """Create a new application."""
    app_id = create_application(
        application.school_name,
        application.program_name,
        application.degree_type,
        application.deadline,
        application.status,
        application.notes
    )
    return {"id": app_id, "message": "Application created successfully"}


@app.get("/api/applications")
async def list_applications(status: Optional[str] = None):
    """Get all applications or filter by status."""
    if status:
        apps = get_applications_by_status(status)
    else:
        apps = get_all_applications()
    return {"applications": apps, "count": len(apps)}


@app.get("/api/applications/{app_id}")
async def get_single_application(app_id: int):
    """Get a single application by ID."""
    app = get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@app.put("/api/applications/{app_id}")
async def update_existing_application(app_id: int, application: ApplicationUpdate):
    """Update an existing application."""
    updates = application.model_dump(exclude_unset=True)
    success = update_application(app_id, **updates)
    if not success:
        raise HTTPException(status_code=404, detail="Application not found or no changes made")
    return {"message": "Application updated successfully"}


@app.delete("/api/applications/{app_id}")
async def delete_existing_application(app_id: int):
    """Delete an application."""
    success = delete_application(app_id)
    if not success:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"message": "Application deleted successfully"}


@app.get("/api/applications/stats/summary")
async def get_stats():
    """Get application statistics."""
    return get_application_stats()


# Task endpoints
@app.post("/api/tasks")
async def create_new_task(task: TaskCreate):
    """Create a new task."""
    task_id = create_task(
        task.title,
        task.application_id,
        task.description,
        task.due_date,
        task.priority,
        task.category,
        task.reminder_date
    )
    return {"id": task_id, "message": "Task created successfully"}


@app.get("/api/tasks")
async def list_tasks(
    status: Optional[str] = None,
    application_id: Optional[int] = None
):
    """Get all tasks with optional filters."""
    if application_id:
        tasks = get_tasks_by_application(application_id)
    elif status:
        tasks = get_tasks_by_status(status)
    else:
        tasks = get_all_tasks()
    return {"tasks": tasks, "count": len(tasks)}


@app.get("/api/tasks/upcoming")
async def get_upcoming(days: int = 7):
    """Get upcoming tasks."""
    tasks = get_upcoming_tasks(days)
    return {"tasks": tasks, "count": len(tasks)}


@app.get("/api/tasks/{task_id}")
async def get_single_task(task_id: int):
    """Get a single task by ID."""
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.put("/api/tasks/{task_id}")
async def update_existing_task(task_id: int, task: TaskUpdate):
    """Update an existing task."""
    updates = task.model_dump(exclude_unset=True)
    success = update_task(task_id, **updates)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found or no changes made")
    return {"message": "Task updated successfully"}


@app.put("/api/tasks/{task_id}/complete")
async def complete_existing_task(task_id: int):
    """Mark a task as completed."""
    success = update_task(task_id, status="completed")
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task marked as completed"}


@app.delete("/api/tasks/{task_id}")
async def delete_existing_task(task_id: int):
    """Delete a task."""
    success = delete_task(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}


@app.get("/api/tasks/stats/summary")
async def get_task_statistics():
    """Get task statistics."""
    return get_task_stats()


# Profile endpoints
@app.get("/api/profile")
async def get_profile():
    """Get user profile."""
    profile = get_user_profile()
    return profile or {}


@app.put("/api/profile")
async def update_profile(profile: ProfileUpdate):
    """Update user profile."""
    updates = profile.model_dump(exclude_unset=True)
    profile_id = update_user_profile(**updates)
    return {"id": profile_id, "message": "Profile updated successfully"}


# Essay endpoints
@app.post("/api/essays")
async def save_new_essay(essay: EssaySave):
    """Save a new essay version."""
    essay_id = save_essay(essay.application_id, essay.content, essay.essay_type)

    # Also store in vector memory for semantic search
    app = get_application(essay.application_id)
    if app:
        store_essay_memory(
            essay.content,
            app['school_name'],
            app['program_name'],
            essay.essay_type
        )

    return {"id": essay_id, "message": "Essay saved successfully"}


@app.get("/api/essays/{app_id}")
async def get_essay(app_id: int, essay_type: str = "sop"):
    """Get the latest essay for an application."""
    essay = get_latest_essay(app_id, essay_type)
    if not essay:
        raise HTTPException(status_code=404, detail="Essay not found")
    return essay


# Interview endpoints
@app.post("/api/interviews")
async def save_interview(notes: InterviewNotes):
    """Save interview notes."""
    note_id = save_interview_notes(
        notes.application_id,
        notes.interview_date,
        notes.interviewer_name,
        notes.notes,
        notes.questions_asked,
        notes.follow_up_items
    )
    return {"id": note_id, "message": "Interview notes saved successfully"}


@app.get("/api/interviews/{app_id}")
async def get_interviews(app_id: int):
    """Get interview notes for an application."""
    notes = get_interview_notes(app_id)
    return {"interviews": notes, "count": len(notes)}


# Chat endpoint
@app.post("/api/chat")
async def chat_with_agent(message: ChatMessage):
    """Chat with the AI assistant."""
    agent = get_agent(TOOL_HANDLERS)
    response = agent.chat(message.message)
    return {"response": response}


@app.post("/api/chat/reset")
async def reset_chat():
    """Reset the chat conversation history."""
    reset_agent()
    return {"message": "Chat history reset successfully"}


# Memory endpoints
@app.get("/api/memory/stats")
async def memory_stats():
    """Get memory statistics."""
    return get_memory_stats()


@app.get("/api/memory/search")
async def search_memory(query: str, n_results: int = 5):
    """Search conversation memory."""
    results = search_conversations(query, n_results)
    return {"results": results, "count": len(results)}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
