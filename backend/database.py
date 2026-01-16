"""
GradTrack AI - Database Manager

This module handles all SQLite database operations for structured data storage.
It manages:
- Applications table (school applications with status tracking)
- User profile table (academic credentials and preferences)
- Interview notes table (for interview preparation)

This is the STRUCTURED memory component of the system.
For SEMANTIC memory (vector search), see memory.py
"""

import sqlite3
from datetime import datetime
from typing import Optional, Dict, List, Any
import json
import os

# Database file path
DB_PATH = os.path.join(os.path.dirname(__file__), "gradtrack.db")


class DatabaseManager:
    """
    Manages SQLite database for structured data storage.
    
    This class provides CRUD operations for:
    - Applications (grad school applications being tracked)
    - User Profile (GPA, GRE scores, preferences, etc.)
    - Interview Notes (preparation notes for interviews)
    """
    
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
    
    def get_connection(self) -> sqlite3.Connection:
        """Get a database connection with row factory for dict-like access"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def initialize_database(self):
        """
        Create all required tables if they don't exist.
        Called on application startup.
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # ============================================
        # Applications Table
        # ============================================
        # Tracks all graduate school applications
        # Status flows: researching -> in_progress -> applied -> interview -> decision
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                school_name TEXT NOT NULL,
                program_name TEXT NOT NULL,
                degree_type TEXT NOT NULL,
                deadline TEXT,
                status TEXT DEFAULT 'researching',
                decision TEXT DEFAULT 'pending',
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # ============================================
        # User Profile Table
        # ============================================
        # Stores the user's academic profile for personalized advice
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_profile (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                gpa REAL,
                gre_verbal INTEGER,
                gre_quant INTEGER,
                gre_writing REAL,
                toefl_score INTEGER,
                major TEXT,
                research_interests TEXT,
                preferred_locations TEXT,
                target_degree TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert default profile row if not exists
        cursor.execute("""
            INSERT OR IGNORE INTO user_profile (id) VALUES (1)
        """)
        
        # ============================================
        # Interview Notes Table
        # ============================================
        # Stores interview preparation notes and experiences
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS interview_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_id INTEGER,
                interview_date TEXT,
                interviewer_name TEXT,
                questions_asked TEXT,
                my_answers TEXT,
                notes TEXT,
                outcome TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (application_id) REFERENCES applications(id)
            )
        """)
        
        # ============================================
        # Tasks Table (for Calendar/To-Do feature)
        # ============================================
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_id INTEGER,
                title TEXT NOT NULL,
                description TEXT,
                due_date TEXT,
                priority TEXT DEFAULT 'medium',
                status TEXT DEFAULT 'pending',
                category TEXT DEFAULT 'other',
                reminder_date TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                completed_at TEXT,
                FOREIGN KEY (application_id) REFERENCES applications(id)
            )
        """)
        
        conn.commit()
        conn.close()
        print("✅ Database tables initialized")
    
    # ============================================
    # Application CRUD Operations
    # ============================================
    
    def create_application(
        self,
        school_name: str,
        program_name: str,
        degree_type: str,
        deadline: Optional[str] = None,
        status: str = "researching",
        decision: Optional[str] = None,
        notes: Optional[str] = None
    ) -> int:
        """
        Create a new application entry.
        Returns the ID of the created application.
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO applications 
            (school_name, program_name, degree_type, deadline, status, decision, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (school_name, program_name, degree_type, deadline, status, decision or "pending", notes))
        
        app_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return app_id
    
    def get_application(self, app_id: int) -> Optional[Dict]:
        """Get a single application by ID"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM applications WHERE id = ?", (app_id,))
        row = cursor.fetchone()
        conn.close()
        
        return dict(row) if row else None
    
    def get_all_applications(self) -> List[Dict]:
        """Get all applications, ordered by deadline"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM applications 
            ORDER BY 
                CASE WHEN deadline IS NULL THEN 1 ELSE 0 END,
                deadline ASC
        """)
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    
    def get_applications_by_status(self, status: str) -> List[Dict]:
        """Get all applications with a specific status"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM applications WHERE status = ?
            ORDER BY deadline ASC
        """, (status,))
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    
    def update_application(self, app_id: int, updates: Dict) -> bool:
        """
        Update an application with the provided fields.
        Returns True if successful, False if not found.
        """
        if not updates:
            return True
        
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Build dynamic UPDATE query
        set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
        values = list(updates.values())
        values.append(datetime.now().isoformat())  # updated_at
        values.append(app_id)
        
        cursor.execute(f"""
            UPDATE applications 
            SET {set_clause}, updated_at = ?
            WHERE id = ?
        """, values)
        
        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        
        return success
    
    def delete_application(self, app_id: int) -> bool:
        """Delete an application by ID"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM applications WHERE id = ?", (app_id,))
        success = cursor.rowcount > 0
        
        conn.commit()
        conn.close()
        
        return success
    
    def search_applications(self, query: str) -> List[Dict]:
        """Search applications by school or program name"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM applications 
            WHERE school_name LIKE ? OR program_name LIKE ?
            ORDER BY deadline ASC
        """, (f"%{query}%", f"%{query}%"))
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    
    # ============================================
    # User Profile Operations
    # ============================================
    
    def get_user_profile(self) -> Optional[Dict]:
        """Get the user's profile"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM user_profile WHERE id = 1")
        row = cursor.fetchone()
        conn.close()
        
        return dict(row) if row else None
    
    def update_user_profile(self, updates: Dict) -> bool:
        """Update the user's profile"""
        if not updates:
            return True
        
        conn = self.get_connection()
        cursor = conn.cursor()
        
        set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
        values = list(updates.values())
        values.append(datetime.now().isoformat())
        
        cursor.execute(f"""
            UPDATE user_profile 
            SET {set_clause}, updated_at = ?
            WHERE id = 1
        """, values)
        
        conn.commit()
        conn.close()
        
        return True
    
    # ============================================
    # Interview Notes Operations
    # ============================================
    
    def add_interview_note(
        self,
        application_id: int,
        interview_date: str,
        interviewer_name: Optional[str] = None,
        questions_asked: Optional[str] = None,
        my_answers: Optional[str] = None,
        notes: Optional[str] = None,
        outcome: Optional[str] = None
    ) -> int:
        """Add an interview note for an application"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO interview_notes 
            (application_id, interview_date, interviewer_name, questions_asked, my_answers, notes, outcome)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (application_id, interview_date, interviewer_name, questions_asked, my_answers, notes, outcome))
        
        note_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return note_id
    
    def get_interview_notes(self, application_id: int) -> List[Dict]:
        """Get all interview notes for an application"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM interview_notes 
            WHERE application_id = ?
            ORDER BY interview_date DESC
        """, (application_id,))
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    
    # ============================================
    # Task Operations (for Calendar/To-Do)
    # ============================================
    
    def create_task(
        self,
        title: str,
        application_id: Optional[int] = None,
        description: Optional[str] = None,
        due_date: Optional[str] = None,
        priority: str = "medium",
        category: str = "other"
    ) -> int:
        """Create a new task"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO tasks 
            (application_id, title, description, due_date, priority, category)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (application_id, title, description, due_date, priority, category))
        
        task_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return task_id
    
    def get_all_tasks(self) -> List[Dict]:
        """Get all tasks ordered by due date"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT t.*, a.school_name, a.program_name
            FROM tasks t
            LEFT JOIN applications a ON t.application_id = a.id
            ORDER BY 
                CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
                t.due_date ASC
        """)
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    
    def update_task(self, task_id: int, updates: Dict) -> bool:
        """Update a task"""
        if not updates:
            return True
        
        conn = self.get_connection()
        cursor = conn.cursor()
        
        set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
        values = list(updates.values())
        values.append(task_id)
        
        cursor.execute(f"""
            UPDATE tasks SET {set_clause} WHERE id = ?
        """, values)
        
        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        
        return success
    
    def complete_task(self, task_id: int) -> bool:
        """Mark a task as completed"""
        return self.update_task(task_id, {
            "status": "completed",
            "completed_at": datetime.now().isoformat()
        })
    
    def delete_task(self, task_id: int) -> bool:
        """Delete a task"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        success = cursor.rowcount > 0
        
        conn.commit()
        conn.close()
        
        return success
    
    # ============================================
    # Statistics and Summary
    # ============================================
    
    def get_application_stats(self) -> Dict:
        """Get statistics about applications"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Count by status
        cursor.execute("""
            SELECT status, COUNT(*) as count 
            FROM applications 
            GROUP BY status
        """)
        status_counts = {row["status"]: row["count"] for row in cursor.fetchall()}
        
        # Count by decision (for those in decision stage)
        cursor.execute("""
            SELECT decision, COUNT(*) as count 
            FROM applications 
            WHERE status = 'decision'
            GROUP BY decision
        """)
        decision_counts = {row["decision"]: row["count"] for row in cursor.fetchall()}
        
        # Upcoming deadlines (next 30 days)
        cursor.execute("""
            SELECT * FROM applications 
            WHERE deadline IS NOT NULL 
            AND deadline >= date('now') 
            AND deadline <= date('now', '+30 days')
            ORDER BY deadline ASC
        """)
        upcoming = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        
        return {
            "by_status": status_counts,
            "by_decision": decision_counts,
            "upcoming_deadlines": upcoming,
            "total": sum(status_counts.values())
        }
    
    def get_summary_for_agent(self) -> str:
        """
        Generate a text summary of the user's applications for the agent.
        This is used to provide context to the LLM.
        """
        applications = self.get_all_applications()
        profile = self.get_user_profile()
        stats = self.get_application_stats()
        
        summary_parts = []
        
        # Profile summary
        if profile:
            profile_info = []
            if profile.get("gpa"):
                profile_info.append(f"GPA: {profile['gpa']}")
            if profile.get("gre_quant") and profile.get("gre_verbal"):
                profile_info.append(f"GRE: V{profile['gre_verbal']}/Q{profile['gre_quant']}")
            if profile.get("major"):
                profile_info.append(f"Major: {profile['major']}")
            if profile.get("target_degree"):
                profile_info.append(f"Target: {profile['target_degree']}")
            if profile_info:
                summary_parts.append("User Profile: " + ", ".join(profile_info))
        
        # Application stats
        summary_parts.append(f"Total Applications: {stats['total']}")
        if stats['by_status']:
            status_str = ", ".join([f"{k}: {v}" for k, v in stats['by_status'].items()])
            summary_parts.append(f"By Status: {status_str}")
        
        # List applications
        if applications:
            app_list = []
            for app in applications[:10]:  # Limit to 10 for context
                deadline_str = f" (due: {app['deadline']})" if app.get('deadline') else ""
                app_list.append(f"- {app['school_name']} {app['program_name']} [{app['status']}]{deadline_str}")
            summary_parts.append("Applications:\n" + "\n".join(app_list))
        
        return "\n".join(summary_parts)
