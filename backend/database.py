"""
Database operations for GradTrack AI using SQLite.
Handles applications, user profiles, and tasks.
"""

import sqlite3
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import contextmanager
import json

DATABASE_PATH = "gradtrack.db"


@contextmanager
def get_db_connection():
    """Context manager for database connections."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_database():
    """Initialize the database with all required tables."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Applications table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                school_name TEXT NOT NULL,
                program_name TEXT NOT NULL,
                degree_type TEXT DEFAULT 'MS',
                deadline DATE,
                status TEXT DEFAULT 'researching',
                decision TEXT DEFAULT 'pending',
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # User profile table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_profile (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gpa REAL,
                gre_verbal INTEGER,
                gre_quant INTEGER,
                gre_writing REAL,
                major TEXT,
                research_interests TEXT,
                preferred_locations TEXT,
                undergraduate_school TEXT,
                work_experience TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Tasks table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_id INTEGER,
                title TEXT NOT NULL,
                description TEXT,
                due_date DATETIME,
                priority TEXT DEFAULT 'medium',
                status TEXT DEFAULT 'pending',
                category TEXT DEFAULT 'other',
                reminder_date DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                FOREIGN KEY (application_id) REFERENCES applications(id)
            )
        """)

        # Essays table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS essays (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_id INTEGER,
                essay_type TEXT DEFAULT 'sop',
                content TEXT,
                version INTEGER DEFAULT 1,
                feedback TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (application_id) REFERENCES applications(id)
            )
        """)

        # Interview notes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS interview_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_id INTEGER NOT NULL,
                interview_date DATETIME,
                interviewer_name TEXT,
                notes TEXT,
                questions_asked TEXT,
                follow_up_items TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (application_id) REFERENCES applications(id)
            )
        """)

        conn.commit()


# Application CRUD operations
def create_application(
    school_name: str,
    program_name: str,
    degree_type: str = "MS",
    deadline: Optional[str] = None,
    status: str = "researching",
    notes: Optional[str] = None
) -> int:
    """Create a new application entry."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO applications (school_name, program_name, degree_type, deadline, status, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (school_name, program_name, degree_type, deadline, status, notes))
        conn.commit()
        return cursor.lastrowid


def get_application(app_id: int) -> Optional[Dict[str, Any]]:
    """Get a single application by ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM applications WHERE id = ?", (app_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_all_applications() -> List[Dict[str, Any]]:
    """Get all applications."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM applications ORDER BY deadline ASC")
        return [dict(row) for row in cursor.fetchall()]


def get_applications_by_status(status: str) -> List[Dict[str, Any]]:
    """Get applications filtered by status."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM applications WHERE status = ? ORDER BY deadline ASC",
            (status,)
        )
        return [dict(row) for row in cursor.fetchall()]


def update_application(app_id: int, **kwargs) -> bool:
    """Update an application with given fields."""
    if not kwargs:
        return False

    valid_fields = {'school_name', 'program_name', 'degree_type', 'deadline',
                   'status', 'decision', 'notes'}
    updates = {k: v for k, v in kwargs.items() if k in valid_fields}

    if not updates:
        return False

    updates['updated_at'] = datetime.now().isoformat()

    set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
    values = list(updates.values()) + [app_id]

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"UPDATE applications SET {set_clause} WHERE id = ?",
            values
        )
        conn.commit()
        return cursor.rowcount > 0


def delete_application(app_id: int) -> bool:
    """Delete an application and its related data."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        # Delete related tasks first
        cursor.execute("DELETE FROM tasks WHERE application_id = ?", (app_id,))
        # Delete related essays
        cursor.execute("DELETE FROM essays WHERE application_id = ?", (app_id,))
        # Delete related interview notes
        cursor.execute("DELETE FROM interview_notes WHERE application_id = ?", (app_id,))
        # Delete the application
        cursor.execute("DELETE FROM applications WHERE id = ?", (app_id,))
        conn.commit()
        return cursor.rowcount > 0


# Task CRUD operations
def create_task(
    title: str,
    application_id: Optional[int] = None,
    description: Optional[str] = None,
    due_date: Optional[str] = None,
    priority: str = "medium",
    category: str = "other",
    reminder_date: Optional[str] = None
) -> int:
    """Create a new task."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO tasks (application_id, title, description, due_date, priority, category, reminder_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (application_id, title, description, due_date, priority, category, reminder_date))
        conn.commit()
        return cursor.lastrowid


def get_task(task_id: int) -> Optional[Dict[str, Any]]:
    """Get a single task by ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_all_tasks() -> List[Dict[str, Any]]:
    """Get all tasks."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tasks ORDER BY due_date ASC")
        return [dict(row) for row in cursor.fetchall()]


def get_tasks_by_application(app_id: int) -> List[Dict[str, Any]]:
    """Get all tasks for a specific application."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM tasks WHERE application_id = ? ORDER BY due_date ASC",
            (app_id,)
        )
        return [dict(row) for row in cursor.fetchall()]


def get_tasks_by_status(status: str) -> List[Dict[str, Any]]:
    """Get tasks filtered by status."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM tasks WHERE status = ? ORDER BY due_date ASC",
            (status,)
        )
        return [dict(row) for row in cursor.fetchall()]


def get_upcoming_tasks(days: int = 7) -> List[Dict[str, Any]]:
    """Get tasks due within the specified number of days."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT t.*, a.school_name, a.program_name
            FROM tasks t
            LEFT JOIN applications a ON t.application_id = a.id
            WHERE t.due_date <= date('now', '+' || ? || ' days')
            AND t.status != 'completed'
            ORDER BY t.due_date ASC
        """, (days,))
        return [dict(row) for row in cursor.fetchall()]


def update_task(task_id: int, **kwargs) -> bool:
    """Update a task with given fields."""
    if not kwargs:
        return False

    valid_fields = {'title', 'description', 'due_date', 'priority',
                   'status', 'category', 'reminder_date', 'application_id'}
    updates = {k: v for k, v in kwargs.items() if k in valid_fields}

    if not updates:
        return False

    # If marking as completed, set completed_at
    if updates.get('status') == 'completed':
        updates['completed_at'] = datetime.now().isoformat()

    set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
    values = list(updates.values()) + [task_id]

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"UPDATE tasks SET {set_clause} WHERE id = ?",
            values
        )
        conn.commit()
        return cursor.rowcount > 0


def delete_task(task_id: int) -> bool:
    """Delete a task."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()
        return cursor.rowcount > 0


# User Profile operations
def get_user_profile() -> Optional[Dict[str, Any]]:
    """Get the user's profile."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM user_profile ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
        return dict(row) if row else None


def update_user_profile(**kwargs) -> int:
    """Update or create user profile."""
    valid_fields = {'gpa', 'gre_verbal', 'gre_quant', 'gre_writing', 'major',
                   'research_interests', 'preferred_locations',
                   'undergraduate_school', 'work_experience'}
    updates = {k: v for k, v in kwargs.items() if k in valid_fields}

    profile = get_user_profile()

    with get_db_connection() as conn:
        cursor = conn.cursor()

        if profile:
            updates['updated_at'] = datetime.now().isoformat()
            set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
            values = list(updates.values()) + [profile['id']]
            cursor.execute(
                f"UPDATE user_profile SET {set_clause} WHERE id = ?",
                values
            )
            profile_id = profile['id']
        else:
            columns = ", ".join(updates.keys())
            placeholders = ", ".join("?" * len(updates))
            cursor.execute(
                f"INSERT INTO user_profile ({columns}) VALUES ({placeholders})",
                list(updates.values())
            )
            profile_id = cursor.lastrowid

        conn.commit()
        return profile_id


# Essay operations
def save_essay(
    application_id: int,
    content: str,
    essay_type: str = "sop",
    feedback: Optional[str] = None
) -> int:
    """Save a new essay version."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Get current version number
        cursor.execute(
            "SELECT MAX(version) FROM essays WHERE application_id = ? AND essay_type = ?",
            (application_id, essay_type)
        )
        result = cursor.fetchone()[0]
        version = (result or 0) + 1

        cursor.execute("""
            INSERT INTO essays (application_id, essay_type, content, version, feedback)
            VALUES (?, ?, ?, ?, ?)
        """, (application_id, essay_type, content, version, feedback))
        conn.commit()
        return cursor.lastrowid


def get_latest_essay(application_id: int, essay_type: str = "sop") -> Optional[Dict[str, Any]]:
    """Get the latest version of an essay."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM essays
            WHERE application_id = ? AND essay_type = ?
            ORDER BY version DESC LIMIT 1
        """, (application_id, essay_type))
        row = cursor.fetchone()
        return dict(row) if row else None


# Interview notes operations
def save_interview_notes(
    application_id: int,
    interview_date: Optional[str] = None,
    interviewer_name: Optional[str] = None,
    notes: Optional[str] = None,
    questions_asked: Optional[str] = None,
    follow_up_items: Optional[str] = None
) -> int:
    """Save interview notes."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO interview_notes
            (application_id, interview_date, interviewer_name, notes, questions_asked, follow_up_items)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (application_id, interview_date, interviewer_name, notes, questions_asked, follow_up_items))
        conn.commit()
        return cursor.lastrowid


def get_interview_notes(application_id: int) -> List[Dict[str, Any]]:
    """Get all interview notes for an application."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM interview_notes WHERE application_id = ? ORDER BY interview_date DESC",
            (application_id,)
        )
        return [dict(row) for row in cursor.fetchall()]


# Statistics and summary functions
def get_application_stats() -> Dict[str, Any]:
    """Get summary statistics about applications."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM applications")
        total = cursor.fetchone()[0]

        cursor.execute("""
            SELECT status, COUNT(*) as count
            FROM applications
            GROUP BY status
        """)
        by_status = {row['status']: row['count'] for row in cursor.fetchall()}

        cursor.execute("""
            SELECT decision, COUNT(*) as count
            FROM applications
            WHERE decision != 'pending'
            GROUP BY decision
        """)
        by_decision = {row['decision']: row['count'] for row in cursor.fetchall()}

        return {
            "total": total,
            "by_status": by_status,
            "by_decision": by_decision
        }


def get_task_stats() -> Dict[str, Any]:
    """Get summary statistics about tasks."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM tasks")
        total = cursor.fetchone()[0]

        cursor.execute("""
            SELECT status, COUNT(*) as count
            FROM tasks
            GROUP BY status
        """)
        by_status = {row['status']: row['count'] for row in cursor.fetchall()}

        cursor.execute("""
            SELECT COUNT(*) FROM tasks
            WHERE due_date <= date('now', '+3 days')
            AND status != 'completed'
        """)
        urgent = cursor.fetchone()[0]

        return {
            "total": total,
            "by_status": by_status,
            "urgent": urgent
        }


# Initialize database on module import
init_database()
