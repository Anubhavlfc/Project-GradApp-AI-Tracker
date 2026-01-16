"""
LLM Agent logic for GradTrack AI.
Handles conversation, tool calling, and response generation.
"""

import os
from openai import OpenAI
from typing import List, Dict, Any, Optional, Callable
import json
from datetime import datetime

from database import (
    get_all_applications, get_application, get_user_profile,
    get_application_stats, get_task_stats, get_upcoming_tasks
)
from memory import store_conversation, build_context, search_conversations


# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# System prompt for the AI assistant
SYSTEM_PROMPT = """You are GradTrack AI, a helpful assistant specialized in helping students with their US graduate school applications.

Your capabilities:
1. Track and manage graduate school applications using a Kanban board system
2. Research graduate programs and provide information about deadlines, requirements, etc.
3. Analyze Statements of Purpose (SOPs) and provide feedback
4. Manage tasks, deadlines, and to-do lists
5. Remember user's profile, preferences, and past conversations

Application statuses: researching, in_progress, applied, interview, decision
Decision statuses: pending, accepted, rejected, waitlisted

When users ask to add or update applications, use the appropriate tools.
When users ask about deadlines or tasks, check their calendar and to-do list.
When users share essay drafts, provide constructive feedback.

Be encouraging but honest. Grad school applications are stressful - be supportive while giving practical advice.

Always be specific when discussing schools and programs. If you don't have information, say so and offer to research it.
"""

# Tool definitions for function calling
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "add_application",
            "description": "Add a new graduate school application to track",
            "parameters": {
                "type": "object",
                "properties": {
                    "school_name": {
                        "type": "string",
                        "description": "Name of the university"
                    },
                    "program_name": {
                        "type": "string",
                        "description": "Name of the program (e.g., 'MS Computer Science')"
                    },
                    "degree_type": {
                        "type": "string",
                        "enum": ["MS", "PhD", "MBA", "MA", "MEng"],
                        "description": "Type of degree"
                    },
                    "deadline": {
                        "type": "string",
                        "description": "Application deadline in YYYY-MM-DD format"
                    },
                    "notes": {
                        "type": "string",
                        "description": "Any notes about this application"
                    }
                },
                "required": ["school_name", "program_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_application_status",
            "description": "Update the status of an existing application",
            "parameters": {
                "type": "object",
                "properties": {
                    "application_id": {
                        "type": "integer",
                        "description": "ID of the application to update"
                    },
                    "status": {
                        "type": "string",
                        "enum": ["researching", "in_progress", "applied", "interview", "decision"],
                        "description": "New status for the application"
                    },
                    "decision": {
                        "type": "string",
                        "enum": ["pending", "accepted", "rejected", "waitlisted"],
                        "description": "Decision result (only for 'decision' status)"
                    }
                },
                "required": ["application_id", "status"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_applications",
            "description": "Get list of all applications or filter by status",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["researching", "in_progress", "applied", "interview", "decision", "all"],
                        "description": "Filter by status, or 'all' for all applications"
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "add_task",
            "description": "Add a new task or to-do item",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Task title"
                    },
                    "application_id": {
                        "type": "integer",
                        "description": "ID of related application (optional)"
                    },
                    "due_date": {
                        "type": "string",
                        "description": "Due date in YYYY-MM-DD format"
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["high", "medium", "low"],
                        "description": "Task priority"
                    },
                    "category": {
                        "type": "string",
                        "enum": ["essay", "lor", "test_scores", "forms", "interview", "other"],
                        "description": "Task category"
                    }
                },
                "required": ["title"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "complete_task",
            "description": "Mark a task as completed",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "integer",
                        "description": "ID of the task to complete"
                    }
                },
                "required": ["task_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_upcoming_deadlines",
            "description": "Get tasks and deadlines coming up soon",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {
                        "type": "integer",
                        "description": "Number of days to look ahead (default 7)"
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "research_program",
            "description": "Research a graduate program to find information about deadlines, requirements, etc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "school_name": {
                        "type": "string",
                        "description": "Name of the university"
                    },
                    "program_name": {
                        "type": "string",
                        "description": "Name of the program"
                    },
                    "info_type": {
                        "type": "string",
                        "enum": ["deadlines", "requirements", "tuition", "faculty", "all"],
                        "description": "Type of information to research"
                    }
                },
                "required": ["school_name", "program_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_essay",
            "description": "Analyze a Statement of Purpose or other essay",
            "parameters": {
                "type": "object",
                "properties": {
                    "essay_content": {
                        "type": "string",
                        "description": "The essay text to analyze"
                    },
                    "school_name": {
                        "type": "string",
                        "description": "Target school for context (optional)"
                    },
                    "program_name": {
                        "type": "string",
                        "description": "Target program for context (optional)"
                    }
                },
                "required": ["essay_content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_profile",
            "description": "Update the user's academic profile",
            "parameters": {
                "type": "object",
                "properties": {
                    "gpa": {"type": "number", "description": "GPA (0-4.0 scale)"},
                    "gre_verbal": {"type": "integer", "description": "GRE Verbal score (130-170)"},
                    "gre_quant": {"type": "integer", "description": "GRE Quantitative score (130-170)"},
                    "major": {"type": "string", "description": "Undergraduate major"},
                    "research_interests": {"type": "string", "description": "Research interests"},
                    "preferred_locations": {"type": "string", "description": "Preferred locations for grad school"}
                }
            }
        }
    }
]


class GradTrackAgent:
    """Main agent class for handling conversations and tool calls."""

    def __init__(self, tool_handlers: Dict[str, Callable] = None):
        self.conversation_history: List[Dict[str, str]] = []
        self.tool_handlers = tool_handlers or {}

    def _build_system_context(self) -> str:
        """Build system context with current user state."""
        context_parts = [SYSTEM_PROMPT]

        # Add user profile if available
        profile = get_user_profile()
        if profile:
            context_parts.append("\n=== User Profile ===")
            if profile.get('gpa'):
                context_parts.append(f"GPA: {profile['gpa']}")
            if profile.get('major'):
                context_parts.append(f"Major: {profile['major']}")
            if profile.get('research_interests'):
                context_parts.append(f"Research Interests: {profile['research_interests']}")
            if profile.get('preferred_locations'):
                context_parts.append(f"Preferred Locations: {profile['preferred_locations']}")

        # Add application summary
        stats = get_application_stats()
        if stats['total'] > 0:
            context_parts.append("\n=== Application Summary ===")
            context_parts.append(f"Total Applications: {stats['total']}")
            for status, count in stats['by_status'].items():
                context_parts.append(f"  {status}: {count}")

        # Add task summary
        task_stats = get_task_stats()
        if task_stats['total'] > 0:
            context_parts.append("\n=== Task Summary ===")
            context_parts.append(f"Total Tasks: {task_stats['total']}")
            context_parts.append(f"Urgent (due in 3 days): {task_stats['urgent']}")

        # Add upcoming deadlines
        upcoming = get_upcoming_tasks(7)
        if upcoming:
            context_parts.append("\n=== Upcoming Deadlines (Next 7 Days) ===")
            for task in upcoming[:5]:
                context_parts.append(
                    f"- {task['title']} (Due: {task['due_date']}) "
                    f"[{task.get('school_name', 'General')}]"
                )

        return "\n".join(context_parts)

    def _handle_tool_call(self, tool_call) -> str:
        """Handle a tool call and return the result."""
        function_name = tool_call.function.name
        arguments = json.loads(tool_call.function.arguments)

        if function_name in self.tool_handlers:
            result = self.tool_handlers[function_name](**arguments)
            return json.dumps(result)
        else:
            return json.dumps({"error": f"Unknown tool: {function_name}"})

    def chat(self, user_message: str) -> str:
        """Process a user message and return the assistant's response."""
        # Build context from memory
        memory_context = build_context(user_message, max_items=3)

        # Prepare messages
        messages = [
            {"role": "system", "content": self._build_system_context()},
        ]

        # Add memory context if available
        if memory_context:
            messages.append({
                "role": "system",
                "content": f"Relevant context from memory:\n{memory_context}"
            })

        # Add conversation history (last 10 turns)
        messages.extend(self.conversation_history[-20:])

        # Add current user message
        messages.append({"role": "user", "content": user_message})

        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto"
        )

        assistant_message = response.choices[0].message

        # Handle tool calls if any
        if assistant_message.tool_calls:
            # Add assistant message with tool calls
            messages.append({
                "role": "assistant",
                "content": assistant_message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    }
                    for tc in assistant_message.tool_calls
                ]
            })

            # Process each tool call
            for tool_call in assistant_message.tool_calls:
                result = self._handle_tool_call(tool_call)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result
                })

            # Get final response after tool calls
            final_response = client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=messages
            )

            assistant_content = final_response.choices[0].message.content
        else:
            assistant_content = assistant_message.content

        # Update conversation history
        self.conversation_history.append({"role": "user", "content": user_message})
        self.conversation_history.append({"role": "assistant", "content": assistant_content})

        # Store in long-term memory
        store_conversation(user_message, assistant_content)

        return assistant_content

    def clear_history(self):
        """Clear the conversation history."""
        self.conversation_history = []


# Singleton agent instance
_agent_instance: Optional[GradTrackAgent] = None


def get_agent(tool_handlers: Dict[str, Callable] = None) -> GradTrackAgent:
    """Get or create the singleton agent instance."""
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = GradTrackAgent(tool_handlers)
    return _agent_instance


def reset_agent():
    """Reset the agent instance."""
    global _agent_instance
    _agent_instance = None
