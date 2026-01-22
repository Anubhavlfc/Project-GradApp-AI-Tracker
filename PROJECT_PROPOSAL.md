# GradTrack AI - Project Proposal

**Course:** Building Agentic AI Applications  
**Author:** Anubhav Adhikari  
**Date:** January 21, 2026  
**Repository:** [GradApp-AI-Tracker](https://github.com/Anubhavlfc/Project-GradApp-AI-Tracker)

---

## Executive Summary

**GradTrack AI** is an intelligent graduate school application management assistant that helps students track, organize, and optimize their US graduate school applications. Unlike simple to-do apps or chatbots, GradTrack AI is a **true agentic system** that maintains persistent state, uses tools to take actions, remembers past conversations, and reasons explicitly about how to help users.

The application features a modern React web interface with a Kanban board for visualizing application status alongside an AI chat interface that can take actions on behalf of the user—adding applications, researching programs, analyzing essays, and managing deadlines.

---

## Problem Statement

Applying to graduate school is a complex, multi-month process involving:
- Tracking 5-15+ applications across different programs with varying deadlines
- Researching program requirements (GRE, TOEFL, GPA, SOP guidelines)
- Writing and iterating on multiple Statement of Purpose essays
- Managing tasks like requesting recommendation letters, ordering transcripts
- Keeping track of interview preparation and application decisions

**Current solutions fail because:**
- Spreadsheets don't provide intelligent assistance or reminders
- Generic to-do apps don't understand the domain
- Existing chatbots can't take action or maintain state across sessions

**GradTrack AI solves this** by combining persistent application tracking with an intelligent agent that can reason about the user's situation and take helpful actions.

---

## Target Users

1. **Primary:** Graduate school applicants (like myself) applying to 5+ US programs
2. **Secondary:** Academic advisors who help students manage multiple applications
3. **Personal:** This is a tool I actually need and will personally use throughout my application cycle

---

## Technical Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                  │
│  ┌──────────────────────┐      ┌─────────────────────────────┐  │
│  │   Kanban Board       │      │     AI Chat Panel           │  │
│  │   - Application cards│      │     - Message history       │  │
│  │   - Drag & drop      │      │     - Tool usage display    │  │
│  │   - Status columns   │      │     - Reasoning trace       │  │
│  └──────────────────────┘      └─────────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ HTTP/REST API
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Python + FastAPI)                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    ReAct Agent (agent.py)                │   │
│  │   OBSERVE → THINK → ACT → OBSERVE → RESPOND             │   │
│  └──────────────────────────────────────────────────────────┘   │
│           │                    │                    │           │
│           ▼                    ▼                    ▼           │
│  ┌─────────────┐    ┌─────────────────┐    ┌───────────────┐   │
│  │ MCP Tools   │    │ Memory Manager  │    │ Database      │   │
│  │ (4 tools)   │    │ (ChromaDB)      │    │ (SQLite)      │   │
│  └─────────────┘    └─────────────────┘    └───────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### The ReAct Agent Loop

The core of the application is an explicit ReAct (Reasoning + Acting) agent that follows this loop:

1. **OBSERVE:** Retrieve relevant context from long-term memory and current application state
2. **THINK:** Analyze user intent and decide whether to use a tool
3. **ACT:** Execute the selected MCP tool with appropriate parameters
4. **OBSERVE:** Process tool results
5. **RESPOND:** Generate a helpful response incorporating tool results and context

This is implemented **explicitly** in `backend/agent.py`—no magic frameworks, full transparency.

---

## MCP Tools (3+ Required)

The agent has access to **4 MCP tools** that it can invoke based on reasoning:

### Tool 1: Application Database (`application_db.py`)
**Purpose:** CRUD operations for graduate school applications

| Action | Description |
|--------|-------------|
| `create` | Add a new application to track |
| `read` | Get details of an application |
| `update` | Modify application status, deadline, notes |
| `delete` | Remove an application |
| `search` | Find applications by school/program |
| `by_status` | Get applications grouped by status |
| `stats` | Get application statistics |

**Example Invocation:**
```json
{
  "action": "create",
  "school_name": "MIT",
  "program_name": "PhD Computer Science",
  "deadline": "2026-12-15",
  "status": "researching"
}
```

### Tool 2: Program Research (`program_research.py`)
**Purpose:** Look up information about graduate programs

**Capabilities:**
- Application deadlines for specific programs
- GRE/TOEFL requirements
- Tuition and funding information
- Program rankings
- Notable faculty members

**Example Invocation:**
```json
{
  "school": "Stanford",
  "program": "Computer Science",
  "info_type": "requirements"
}
```

### Tool 3: Essay Analyzer (`essay_analyzer.py`)
**Purpose:** Analyze and provide feedback on Statement of Purpose essays

**Analysis includes:**
- Overall quality score (0-100)
- Structure analysis (intro, body, conclusion)
- Keyword coverage by category (research, skills, goals)
- Clarity and readability metrics
- Specific improvement suggestions
- Red flags (clichés, common mistakes)

**Example Invocation:**
```json
{
  "essay_text": "My passion for machine learning...",
  "target_school": "Stanford",
  "analysis_type": "full"
}
```

### Tool 4: Calendar & To-Do (`calendar_todo.py`)
**Purpose:** Manage tasks and application deadlines

| Action | Description |
|--------|-------------|
| `create_task` | Add a new task with due date and priority |
| `list_tasks` | View all pending tasks |
| `complete_task` | Mark a task as done |
| `upcoming` | Get tasks due within N days |
| `overdue` | Get overdue tasks |
| `by_application` | Get tasks for a specific application |

**Example Invocation:**
```json
{
  "action": "upcoming",
  "days_ahead": 7
}
```

---

## Long-Term Memory System

The application implements a **dual-layer memory system**:

### 1. Structured Memory (SQLite)
Stores exact, queryable data:
- **Applications table:** School, program, deadline, status, decision, notes
- **User profile table:** GPA, GRE scores, major, research interests
- **Tasks table:** To-do items with due dates and priorities

### 2. Semantic Memory (ChromaDB)
Stores embeddings for similarity search:
- Conversation history (summarized)
- Essay drafts (for comparison and context)
- User preferences (learned over time)

**How memory enables agentic behavior:**

```python
# When user sends: "What schools did I mention wanting in California?"
# The agent can:
1. Search semantic memory for conversations mentioning California
2. Retrieve relevant past messages
3. Combine with current application data
4. Give a contextual response

# Result: "You mentioned preferring UC Berkeley and Stanford. 
# You have applications for both in 'In Progress' status."
```

This enables the agent to:
- Remember past conversations across sessions
- Learn user preferences over time
- Provide contextual suggestions based on history
- Avoid asking for information already provided

---

## Web Interface (UI Requirement)

### Frontend Technology Stack
- **React 18** with Vite for fast development
- **Tailwind CSS** for modern, responsive styling
- **HTML5 Drag & Drop** for Kanban functionality

### Main Layout

The interface is split into two main sections:

**Left Panel: Kanban Board**
- Four status columns: Researching → In Progress → Applied → Decision
- Draggable application cards
- Visual indicators for deadlines (red = urgent, yellow = soon)
- Quick-add functionality

**Right Panel: AI Chat**
- Conversational interface with the ReAct agent
- Tool usage indicators (shows when agent uses a tool)
- Reasoning trace toggle (for debugging/transparency)
- Message history with timestamps

### Example Interaction Flow

```
User: "Add Berkeley EECS PhD to my list"
            ↓
[Agent decides to use application_database tool]
            ↓
[UI shows: "🔧 Using: application_database"]
            ↓
Agent: "I've added UC Berkeley EECS PhD to your Researching column. 
        The deadline is December 15th. Would you like me to look up 
        the specific requirements for this program?"
            ↓
[Kanban board updates to show new card in Researching column]
```

---

## Verification Plan

### Automated Testing

1. **Unit Tests for MCP Tools**
   ```bash
   pytest tests/test_tools.py
   ```
   - Test each tool action independently
   - Verify parameter validation
   - Check error handling

2. **Agent Decision Tests**
   ```bash
   pytest tests/test_agent.py
   ```
   - Test tool selection for various user inputs
   - Verify reasoning chain execution
   - Test fallback behavior when LLM unavailable

3. **Memory System Tests**
   ```bash
   pytest tests/test_memory.py
   ```
   - Test storage and retrieval
   - Verify semantic search accuracy
   - Test persistence across sessions

### Integration Testing

1. **API Endpoint Tests**
   - Test chat endpoint with various messages
   - Verify application CRUD through API
   - Test concurrent request handling

2. **End-to-End Browser Tests**
   - Add application via chat → verify Kanban update
   - Drag card to new column → verify database update
   - Research program → verify tool result display

### Manual Verification

1. **Conversation Memory Test**
   - Tell the agent about preferences ("I prefer California schools")
   - Close and reopen the application
   - Ask "What did I say I prefer?" → Should retrieve from memory

2. **Multi-Tool Workflow Test**
   - "Add MIT CS PhD and tell me about their requirements"
   - Verify both tools execute and results combine correctly

3. **Essay Analysis Test**
   - Paste a sample SOP
   - Verify scoring and suggestions are reasonable
   - Check that essay is stored in memory for later reference

---

## Deployment Plan

### Local Development
- Frontend: `npm run dev` on port 3000
- Backend: `python main.py` on port 8000

### Production (Optional - Modal.com)
The application can be deployed serverlessly on Modal.com:
- FastAPI backend as a Modal web endpoint
- ChromaDB storage as a Modal volume
- Frontend served via Vercel or Modal static hosting

---

## Scope & Ambition Justification

This project is significantly more complex than what Claude Opus 4.5 could build in an evening because:

1. **Multi-system Integration:** Coordinates frontend, backend, database, vector store, and LLM
2. **Explicit Agent Architecture:** Custom ReAct implementation, not just API wrapper
3. **Dual Memory System:** Both structured (SQLite) and semantic (ChromaDB) storage
4. **4 Production-Quality Tools:** Each with multiple actions and proper error handling
5. **Real-Time UI Updates:** Kanban board syncs with agent actions
6. **Graceful Degradation:** Works even without OpenAI key (rule-based fallbacks)

The codebase consists of:
- ~500 lines of agent logic
- ~500 lines of memory management
- ~320 lines per MCP tool (1,280+ total)
- ~600 lines of database operations
- ~1,000+ lines of React components

---

## Timeline

| Week | Milestone |
|------|-----------|
| Week 1 | Core agent + application database tool ✅ |
| Week 2 | Additional tools + memory system ✅ |
| Week 3 | Frontend integration + Kanban ✅ |
| Week 4 | Polish, testing, documentation |
| Week 5 | Presentation + demo |

---

## Conclusion

GradTrack AI demonstrates the core characteristics of an agentic AI application:
- **Persistent State:** Applications and preferences survive across sessions
- **Tool Use:** 4 MCP tools the agent invokes based on reasoning
- **Long-Term Memory:** Semantic retrieval of past conversations
- **Explicit Reasoning:** Transparent ReAct loop with visible reasoning trace
- **Real-World Utility:** Solves an actual problem I face as a grad school applicant

The application is not a simple chatbot or wrapper—it's a full-stack agentic system that takes actions, maintains state, and learns from interactions.

---

**Built with ❤️ for stressed grad school applicants everywhere.**
