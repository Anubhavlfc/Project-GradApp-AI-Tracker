# GradTrack AI 🎓

> **A university final project demonstrating an agentic AI web application**

An AI-powered assistant to help students manage their US graduate school applications. This project demonstrates **state, tools, memory, and reasoning across time** — the core characteristics of an agentic AI system.

---

## 📌 What Makes This Agentic?

This is **not a simple chatbot**. GradTrack AI demonstrates true agentic behavior:

| Characteristic | How It's Implemented |
|---------------|---------------------|
| **Persistent State** | SQLite database stores applications, profiles, and interview notes across sessions |
| **Tool Use** | 4 MCP tools the agent can invoke based on reasoning |
| **Long-term Memory** | ChromaDB stores conversation history for semantic retrieval |
| **Explicit Reasoning** | ReAct-style agent loop with visible reasoning trace |
| **Separation of Concerns** | Clear boundaries between UI, Agent, Tools, and Memory |

### The ReAct Agent Loop

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                    USER MESSAGE                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  OBSERVE: Retrieve relevant memory context                  │
│  - Search vector DB for similar past conversations          │
│  - Get current application state from SQLite                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  THINK: Decide if tool is needed                            │
│  - Analyze user intent                                      │
│  - Select appropriate tool (or none)                        │
│  - Determine tool parameters                                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  ACT: Execute tool if needed                                │
│  - Call MCP tool with parameters                            │
│  - Observe tool output                                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  RESPOND: Generate final response                           │
│  - Incorporate tool results                                 │
│  - Use context from memory                                  │
│  - Store interaction for future reference                   │
└─────────────────────────────────────────────────────────────┘
\`\`\`

---

## 🛠️ MCP Tools

The agent has access to 4 Model Context Protocol (MCP) tools:

### 1. Application Database Tool (\`application_db.py\`)
**Purpose:** CRUD operations for graduate school applications

\`\`\`python
# Example tool invocation by the agent:
{
    "action": "create",
    "school_name": "MIT",
    "program_name": "PhD Computer Science",
    "degree_type": "PhD",
    "deadline": "2026-12-15",
    "status": "researching"
}
\`\`\`

**Actions:** \`create\`, \`read\`, \`update\`, \`delete\`, \`search\`, \`stats\`, \`by_status\`

### 2. Program Research Tool (\`program_research.py\`)
**Purpose:** Look up information about graduate programs

\`\`\`python
# Example tool invocation:
{
    "school": "Stanford",
    "program": "Computer Science",
    "info_type": "all"  # or: deadline, requirements, funding, ranking, faculty
}
\`\`\`

**Returns:** Deadlines, GRE/TOEFL requirements, tuition, funding options, rankings

### 3. Essay Analyzer Tool (\`essay_analyzer.py\`)
**Purpose:** Analyze Statement of Purpose essays

\`\`\`python
# Example tool invocation:
{
    "essay_text": "My research interests...",
    "target_school": "Stanford",
    "analysis_type": "full"
}
\`\`\`

**Returns:** Structure score, keyword analysis, clarity metrics, improvement suggestions

### 4. Calendar & To-Do Tool (\`calendar_todo.py\`)
**Purpose:** Manage tasks and deadlines

\`\`\`python
# Example tool invocation:
{
    "action": "upcoming",
    "days_ahead": 7
}
\`\`\`

**Actions:** \`create_task\`, \`list_tasks\`, \`complete_task\`, \`delete_task\`, \`upcoming\`, \`overdue\`

---

## �� Long-Term Memory System

The memory system has two components:

### 1. Structured Memory (SQLite)
Stores exact, queryable data:
- **Applications table:** School, program, deadline, status, decision, notes
- **User profile table:** GPA, GRE scores, major, research interests
- **Interview notes table:** Questions asked, preparation notes
- **Tasks table:** To-do items with due dates and priorities

### 2. Semantic Memory (ChromaDB)
Stores embeddings for similarity search:
- Conversation history (summarized)
- Essay drafts
- User preferences

**How memory is used:**
1. When user sends a message, the agent searches for relevant past conversations
2. Matching memories are injected into the agent's context
3. After responding, the conversation is stored for future retrieval

This enables the agent to remember things like:
> "You mentioned last week that you prefer schools in California with strong AI research."

---

## 💻 Application Layout

\`\`\`
┌────────────────────────────────────────────────────────────────┐
│  GradTrack AI                                    [Connected 🟢]│
├────────────────────────────────┬───────────────────────────────┤
│                                │                               │
│   KANBAN BOARD                 │   AI CHAT                     │
│                                │                               │
│  Researching    In Progress    │  You: "What's the deadline    │
│  ┌─────────┐   ┌─────────┐     │   for Stanford MS CS?"        │
│  │ MIT     │   │ Stanford│     │                               │
│  │ Berkeley│   │         │     │  AI: "Stanford MS CS          │
│  └─────────┘   └─────────┘     │   deadline is Dec 1.          │
│                                │   You have 3 weeks left!"     │
│  Applied        Decision       │                               │
│  ┌─────────┐   ┌─────────┐     │  [Tools Used: program_research]│
│  │ CMU     │   │ ✅ UCLA │     │                               │
│  │ GaTech  │   │ ❌ Penn │     │                               │
│  └─────────┘   └─────────┘     │  [Type your message...]       │
│                                │                               │
└────────────────────────────────┴───────────────────────────────┘
\`\`\`

---

## 📁 Project Structure

\`\`\`
gradtrack-ai/
├── frontend/                      # React + Tailwind CSS
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat/
│   │   │   │   └── ChatPanel.jsx       # AI chat interface
│   │   │   ├── Kanban/
│   │   │   │   ├── KanbanBoard.jsx     # Main board component
│   │   │   │   ├── KanbanColumn.jsx    # Column component
│   │   │   │   ├── ApplicationCard.jsx # Draggable card
│   │   │   │   └── AddApplicationModal.jsx
│   │   │   └── common/
│   │   │       └── Header.jsx
│   │   ├── api/
│   │   │   └── index.js               # API client
│   │   ├── styles/
│   │   │   └── index.css              # Tailwind + custom styles
│   │   ├── App.jsx                    # Root component
│   │   └── main.jsx                   # Entry point
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── backend/                       # Python + FastAPI
│   ├── main.py                    # API entry point, routes
│   ├── agent.py                   # ReAct agent implementation
│   ├── memory.py                  # Long-term memory (ChromaDB)
│   ├── database.py                # SQLite operations
│   ├── requirements.txt
│   └── .env.example
│
├── mcp_tools/                     # MCP tool implementations
│   ├── __init__.py                # Tool registration
│   ├── application_db.py          # Application CRUD
│   ├── program_research.py        # Program info lookup
│   ├── essay_analyzer.py          # SOP analysis
│   └── calendar_todo.py           # Task management
│
├── .gitignore
└── README.md                      # This file
\`\`\`

---

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- OpenAI API key

### Installation

1. **Clone the repository**
   \`\`\`bash
   git clone https://github.com/Anubhavlfc/Project-GradApp-AI-Tracker.git
   cd Project-GradApp-AI-Tracker
   \`\`\`

2. **Set up the backend**
   \`\`\`bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   \`\`\`

3. **Configure environment**
   \`\`\`bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   \`\`\`

4. **Set up the frontend**
   \`\`\`bash
   cd ../frontend
   npm install
   \`\`\`

5. **Run the application**

   Terminal 1 (Backend):
   \`\`\`bash
   cd backend
   source venv/bin/activate
   python main.py
   \`\`\`

   Terminal 2 (Frontend):
   \`\`\`bash
   cd frontend
   npm run dev
   \`\`\`

6. **Open in browser**
   Navigate to \`http://localhost:3000\`

---

## 💬 Example Agent Interactions

### Adding an Application
**User:** "Add MIT EECS PhD to my list"

**Agent Reasoning:**
\`\`\`
[OBSERVE] Retrieving relevant context from memory...
[THINK] Analyzing user intent - wants to add new application
[THINK] Decision: Use tool - application_database
[ACT] Executing tool: application_database
[ACT] Parameters: {"action": "create", "school_name": "MIT", "program_name": "EECS PhD", "degree_type": "PhD"}
[OBSERVE] Tool result: {"success": true, "id": 6}
[RESPOND] Generating response...
\`\`\`

**Agent Response:** "I've added MIT EECS PhD to your Researching column. The deadline is December 15, 2026. Would you like me to research more details about this program?"

### Researching a Program
**User:** "What's the deadline for Stanford CS?"

**Agent Reasoning:**
\`\`\`
[OBSERVE] Retrieving relevant context from memory...
[THINK] User wants program information - using program_research tool
[ACT] Executing tool: program_research
[ACT] Parameters: {"school": "Stanford", "program": "Computer Science", "info_type": "deadline"}
[OBSERVE] Tool result: {"deadline": "December 1", "deadline_date": "2025-12-01"}
[RESPOND] Generating response with deadline information
\`\`\`

**Agent Response:** "Stanford's MS/PhD Computer Science deadline is December 1st. Note that they don't require GRE scores. You currently have Stanford in your 'In Progress' column."

### Essay Analysis
**User:** "Analyze my SOP: [essay text]"

**Agent Response includes:**
- Overall score (0-100)
- Structure analysis
- Keyword coverage by category
- Specific improvement suggestions
- Red flags (clichés to avoid)

### Task Management
**User:** "What tasks do I have coming up this week?"

**Agent Response:** "You have 3 tasks due this week:
1. 🔴 MIT SOP final draft (Dec 12) - HIGH priority
2. 🟡 Request Berkeley LOR (Dec 13) - MEDIUM priority  
3. 🟡 Submit Stanford application (Dec 15) - MEDIUM priority"

---

## 📊 Database Schema

### Applications Table
\`\`\`sql
CREATE TABLE applications (
    id INTEGER PRIMARY KEY,
    school_name TEXT NOT NULL,
    program_name TEXT NOT NULL,
    degree_type TEXT NOT NULL,
    deadline TEXT,
    status TEXT DEFAULT 'researching',
    decision TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TEXT,
    updated_at TEXT
)
\`\`\`

### User Profile Table
\`\`\`sql
CREATE TABLE user_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    gpa REAL,
    gre_verbal INTEGER,
    gre_quant INTEGER,
    major TEXT,
    research_interests TEXT,
    preferred_locations TEXT
)
\`\`\`

### Tasks Table
\`\`\`sql
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY,
    application_id INTEGER,
    title TEXT NOT NULL,
    due_date TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    category TEXT
)
\`\`\`

---

## 🏗️ Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | React 18 + Vite | User interface |
| Styling | Tailwind CSS | Responsive design |
| Backend | Python + FastAPI | API server |
| AI/LLM | OpenAI GPT-4 | Agent reasoning |
| Structured DB | SQLite | Applications, profile |
| Vector DB | ChromaDB | Semantic memory |
| Drag & Drop | HTML5 DnD | Kanban functionality |

---

## 🔍 Key Files to Review

For understanding the agentic architecture:

1. **\`backend/agent.py\`** - The ReAct agent loop with explicit reasoning
2. **\`backend/memory.py\`** - Long-term memory with semantic search
3. **\`mcp_tools/application_db.py\`** - Example MCP tool implementation
4. **\`frontend/src/components/Chat/ChatPanel.jsx\`** - Agent interaction UI

---

## 🎯 Design Decisions

1. **Explicit Agent Loop:** No magic frameworks. The ReAct loop is visible in \`agent.py\`
2. **Separation of Concerns:** UI knows nothing about agent logic; tools know nothing about memory
3. **Graceful Degradation:** System works without OpenAI (using rule-based fallbacks)
4. **Transparent Reasoning:** UI can display the agent's reasoning steps
5. **Persistent State:** All data survives server restarts

---

## 🔮 Future Improvements

- [ ] Google Calendar integration
- [ ] Email reminders for deadlines
- [ ] Faculty matching based on research interests
- [ ] Side-by-side school comparison
- [ ] Mobile app version
- [ ] Multi-user support

---

## 📝 License

MIT License - Created as a university final project demonstrating agentic AI systems.

---

**Built with ❤️ for stressed grad school applicants everywhere.**
