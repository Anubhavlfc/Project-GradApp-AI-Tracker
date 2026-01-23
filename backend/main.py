"""
GradTrack AI - FastAPI Backend Entry Point

This is the main API server for the GradTrack AI application.
It provides endpoints for:
- Chat interactions with the AI agent
- Application CRUD operations
- User profile management
- Memory retrieval

The agent logic is separated into agent.py for clarity.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uvicorn
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import our modules
from database import DatabaseManager
from memory import MemoryManager
from agent import GradTrackAgent
from email_service import EmailIntegrationService

# Initialize FastAPI app
app = FastAPI(
    title="GradTrack AI",
    description="An agentic AI assistant for graduate school applications",
    version="1.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize managers
db_manager = DatabaseManager()
memory_manager = MemoryManager()
agent = GradTrackAgent(db_manager, memory_manager)
email_service = EmailIntegrationService()


# ============================================
# Pydantic Models for Request/Response
# ============================================

class ChatRequest(BaseModel):
    """User message to the AI agent"""
    message: str
    session_id: Optional[str] = "default"


class ChatResponse(BaseModel):
    """Agent response with metadata"""
    response: str
    tools_used: List[str]
    reasoning_steps: List[str]


class ApplicationCreate(BaseModel):
    """Create a new application"""
    school_name: str
    program_name: str
    degree_type: str  # MS, PhD, etc.
    deadline: Optional[str] = None
    status: str = "researching"  # researching, in_progress, applied, interview, decision
    decision: Optional[str] = None  # accepted, rejected, waitlisted, pending
    notes: Optional[str] = None


class ApplicationUpdate(BaseModel):
    """Update an existing application"""
    school_name: Optional[str] = None
    program_name: Optional[str] = None
    degree_type: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[str] = None
    decision: Optional[str] = None
    notes: Optional[str] = None


class UserProfileUpdate(BaseModel):
    """Update user profile"""
    gpa: Optional[float] = None
    gre_verbal: Optional[int] = None
    gre_quant: Optional[int] = None
    gre_writing: Optional[float] = None
    toefl_score: Optional[int] = None
    major: Optional[str] = None
    research_interests: Optional[str] = None
    preferred_locations: Optional[str] = None
    target_degree: Optional[str] = None


# ============================================
# Chat Endpoints (Agent Interaction)
# ============================================

@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    """
    Main endpoint for interacting with the AI agent.
    
    The agent will:
    1. Retrieve relevant memory context
    2. Decide if tools are needed
    3. Execute tools if necessary
    4. Generate a response
    5. Store the interaction in memory
    """
    try:
        result = await agent.process_message(request.message, request.session_id)
        return ChatResponse(
            response=result["response"],
            tools_used=result.get("tools_used", []),
            reasoning_steps=result.get("reasoning_steps", [])
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Application CRUD Endpoints
# ============================================

@app.get("/api/applications")
async def get_all_applications():
    """Get all applications for the Kanban board"""
    applications = db_manager.get_all_applications()
    return {"applications": applications}


@app.get("/api/applications/{app_id}")
async def get_application(app_id: int):
    """Get a specific application by ID"""
    application = db_manager.get_application(app_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


@app.post("/api/applications")
async def create_application(app: ApplicationCreate):
    """Create a new application"""
    app_id = db_manager.create_application(
        school_name=app.school_name,
        program_name=app.program_name,
        degree_type=app.degree_type,
        deadline=app.deadline,
        status=app.status,
        decision=app.decision,
        notes=app.notes
    )
    return {"id": app_id, "message": "Application created successfully"}


@app.put("/api/applications/{app_id}")
async def update_application(app_id: int, app: ApplicationUpdate):
    """Update an existing application"""
    success = db_manager.update_application(app_id, app.model_dump(exclude_none=True))
    if not success:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"message": "Application updated successfully"}


@app.delete("/api/applications/{app_id}")
async def delete_application(app_id: int):
    """Delete an application"""
    success = db_manager.delete_application(app_id)
    if not success:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"message": "Application deleted successfully"}


@app.put("/api/applications/{app_id}/status")
async def update_application_status(app_id: int, status: str):
    """Update just the status of an application (for drag-and-drop)"""
    success = db_manager.update_application(app_id, {"status": status})
    if not success:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"message": "Status updated successfully"}


# ============================================
# User Profile Endpoints
# ============================================

@app.get("/api/profile")
async def get_user_profile():
    """Get the user's academic profile"""
    profile = db_manager.get_user_profile()
    return profile if profile else {}


@app.put("/api/profile")
async def update_user_profile(profile: UserProfileUpdate):
    """Update the user's academic profile"""
    db_manager.update_user_profile(profile.model_dump(exclude_none=True))
    return {"message": "Profile updated successfully"}


# ============================================
# Memory Endpoints (for debugging/transparency)
# ============================================

@app.get("/api/memory/search")
async def search_memory(query: str, limit: int = 5):
    """Search semantic memory for relevant context"""
    results = memory_manager.search_similar(query, limit)
    return {"results": results}


@app.get("/api/memory/conversations")
async def get_recent_conversations(limit: int = 10):
    """Get recent conversation history"""
    conversations = memory_manager.get_recent_conversations(limit)
    return {"conversations": conversations}


# ============================================
# Email Integration Endpoints
# ============================================

@app.post("/api/email/authenticate")
async def authenticate_email():
    """
    Authenticate with Gmail API.
    This will open a browser window for OAuth flow on first use.
    """
    try:
        success = email_service.authenticate_gmail()
        if success:
            return {"message": "Gmail authentication successful", "authenticated": True}
        else:
            return {"message": "Gmail authentication failed. Check credentials.", "authenticated": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/email/scan")
async def scan_emails(days_back: int = 365):
    """
    Scan inbox for graduate school application emails.
    Returns detected applications without saving them.
    """
    try:
        if not email_service.gmail_service:
            raise HTTPException(
                status_code=401,
                detail="Gmail not authenticated. Call /api/email/authenticate first."
            )

        applications = email_service.scan_for_applications(days_back=days_back)

        return {
            "message": f"Found {len(applications)} applications",
            "count": len(applications),
            "applications": applications
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/email/import")
async def import_from_email(days_back: int = 365, auto_import: bool = False):
    """
    Scan emails and optionally auto-import detected applications.

    Args:
        days_back: Number of days to look back
        auto_import: If True, automatically create applications in database
    """
    try:
        if not email_service.gmail_service:
            raise HTTPException(
                status_code=401,
                detail="Gmail not authenticated. Call /api/email/authenticate first."
            )

        # Scan for applications
        detected_apps = email_service.scan_for_applications(days_back=days_back)

        if not auto_import:
            return {
                "message": f"Found {len(detected_apps)} applications. Set auto_import=true to import.",
                "count": len(detected_apps),
                "applications": detected_apps
            }

        # Auto-import detected applications
        imported = []
        skipped = []

        for app_data in detected_apps:
            # Check if application already exists
            existing = db_manager.get_all_applications()
            exists = any(
                ex['school_name'].lower() == app_data['school_name'].lower() and
                ex['program_name'].lower() == app_data['program_name'].lower()
                for ex in existing
            )

            if exists:
                skipped.append(app_data)
                continue

            # Create new application
            app_id = db_manager.create_application(
                school_name=app_data['school_name'],
                program_name=app_data['program_name'],
                degree_type=app_data.get('degree_type', 'Other'),
                deadline=app_data.get('deadline'),
                status=app_data.get('status', 'researching'),
                decision=app_data.get('decision'),
                notes=app_data.get('notes', f"Auto-imported from email ({app_data.get('email_type')})")
            )

            imported.append({**app_data, 'id': app_id})

        return {
            "message": f"Imported {len(imported)} applications, skipped {len(skipped)} duplicates",
            "imported": len(imported),
            "skipped": len(skipped),
            "imported_applications": imported,
            "skipped_applications": skipped
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/email/status")
async def get_email_integration_status():
    """Check if Gmail is authenticated and ready."""
    return {
        "authenticated": email_service.gmail_service is not None,
        "ready": email_service.gmail_service is not None
    }


# ============================================
# Health Check
# ============================================

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "database": "connected",
        "memory": "initialized"
    }


# ============================================
# Startup and Shutdown Events
# ============================================

@app.on_event("startup")
async def startup_event():
    """Initialize database and memory on startup"""
    print("🚀 Starting GradTrack AI Backend...")
    db_manager.initialize_database()
    memory_manager.initialize()
    print("✅ Database and memory systems initialized")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    print("👋 Shutting down GradTrack AI Backend...")


# ============================================
# Run the server
# ============================================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True  # Enable hot reload for development
    )
