# GradTrack AI 🎓

A smart AI-powered assistant to help students manage their US graduate school applications. Track applications, research programs, analyze your essays, manage deadlines, and get personalized advice — all in one place.

---

## 📌 What is GradTrack AI?

Applying to graduate schools is stressful. You have to:
- Keep track of multiple schools and deadlines
- Research program requirements
- Write different essays for each school
- Prepare for interviews
- Manage countless to-do items and tasks
- Remember what you've done and what's left

**GradTrack AI** solves this by giving you:
1. A **visual Kanban board** to track all your applications
2. An **AI chat assistant** that knows your profile and helps you along the way
3. **Smart tools** that research schools, improve your essays, and manage your tasks
4. A **calendar & to-do system** to never miss a deadline

---

## 🎯 Key Features

### 1. Application Tracker (Kanban Board)
Organize your applications into columns:
- 📚 **Researching** — Schools you're exploring
- ✏️ **In Progress** — Currently working on application
- 📨 **Applied** — Submitted applications
- 🎤 **Interview** — Schools that invited you for interviews
- ✅ **Decision** — Acceptances, rejections, waitlists

Drag and drop schools as your status changes!

### 2. AI Chat Assistant
Talk to the AI assistant to:
- Get advice on your application strategy
- Ask questions about specific programs
- Get help preparing for interviews
- Discuss your career goals

The assistant **remembers** your past conversations and profile.

### 3. Program Research Tool
Ask the AI to research any school/program:
- Application deadlines
- GRE/TOEFL requirements
- Tuition and funding options
- Acceptance rates
- Faculty and research areas

### 4. Essay/SOP Analyzer
Paste your Statement of Purpose and get:
- Feedback on clarity and structure
- Keyword suggestions based on the program
- Tips to make your essay stand out

### 5. Calendar & To-Do Manager
Stay organized with smart task tracking:
- 📅 **Deadline Calendar** — View all deadlines in calendar format
- ✅ **To-Do Lists** — Create task lists for each application
- 🔔 **Smart Reminders** — Get notified before deadlines
- 📊 **Progress Tracking** — See completion status at a glance

### 6. Long-Term Memory
The AI remembers:
- Your academic profile (GPA, GRE, major, etc.)
- All your applications and their status
- Your essays and drafts
- Interview notes
- Your tasks and to-do items
- Your preferences (location, funding needs, etc.)

---

## 🛠️ MCP Tools

This project uses 4 MCP (Model Context Protocol) tools:

| Tool | What It Does |
|------|--------------|
| **Application Database** | Stores and manages all your applications (add, update, delete, view) |
| **Program Research** | Searches the web for program information like deadlines, requirements, rankings |
| **Essay Analyzer** | Analyzes your Statement of Purpose and gives improvement suggestions |
| **Calendar & To-Do** | Manages deadlines, tasks, and reminders for your grad applications |

### Calendar & To-Do Tool Features

The Calendar tool provides comprehensive task management:

```
┌─────────────────────────────────────────────────────────────┐
│  📅 January 2026                           ◀  Today  ▶     │
├─────┬─────┬─────┬─────┬─────┬─────┬─────┬──────────────────┤
│ Sun │ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │   UPCOMING       │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                  │
│     │     │     │  1  │  2  │  3  │  4  │  🔴 Dec 15       │
│     │     │     │     │     │     │     │  MIT Deadline    │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                  │
│  5  │  6  │  7  │  8  │  9  │ 10  │ 11  │  🟡 Dec 20       │
│     │     │     │     │     │     │     │  Stanford SOP    │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                  │
│ 12  │ 13  │ 14  │ 15🔴│ 16  │ 17  │ 18  │  🟢 Jan 5        │
│     │     │     │ MIT │     │     │     │  Request LORs    │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┴──────────────────┘
```

**Task Categories:**
- 🔴 **Urgent** — Due within 3 days
- 🟡 **Upcoming** — Due within 1 week
- 🟢 **Planned** — Due later

**Task Types:**
- Application deadlines
- Essay drafts & revisions
- Letter of recommendation requests
- Test score submissions
- Interview preparation
- Document gathering

---

## 💻 How It Looks

```
┌────────────────────────────────────────────────────────────────┐
│  GradTrack AI                                    [Calendar 📅] │
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
│  ┌─────────┐   ┌─────────┐     │  ─────────────────────────    │
│  │ CMU     │   │ ✅ UCLA │     │  📋 YOUR TO-DOS TODAY:        │
│  │ GaTech  │   │ ❌ Penn │     │  ☐ Finalize Stanford SOP      │
│  └─────────┘   └─────────┘     │  ☑ Request MIT LOR            │
│                                │  ☐ Submit GRE scores          │
│                                │                               │
│                                │  [Type your message...]       │
└────────────────────────────────┴───────────────────────────────┘
```

---

## 🧠 How Long-Term Memory Works

The AI stores information in two ways:

1. **Structured Database (SQLite)**
   - Your applications (school, program, deadline, status)
   - Your profile information
   - Interview notes
   - Tasks and to-do items

2. **Vector Database (ChromaDB)**
   - Conversation history
   - Essay drafts
   - Semantic search for relevant past context

This allows the AI to remember things like:
> "You mentioned last week that you prefer schools in California with strong AI research."
> "You have 3 pending tasks for your Stanford application."

---

## 🏗️ Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + Tailwind CSS |
| Backend | Python with FastAPI |
| AI/LLM | OpenAI GPT-4 API |
| MCP Tools | Model Context Protocol SDK |
| Database | SQLite (structured data) |
| Memory | ChromaDB (vector storage) |
| Calendar | React Calendar + date-fns |

---

## 📁 Project Structure

```
gradtrack-ai/
├── frontend/                   # React web application
│   ├── components/             # UI components
│   │   ├── Kanban/             # Kanban board components
│   │   ├── Chat/               # AI chat interface
│   │   ├── Calendar/           # Calendar & to-do components
│   │   │   ├── CalendarView.jsx
│   │   │   ├── TodoList.jsx
│   │   │   ├── TaskCard.jsx
│   │   │   └── ReminderModal.jsx
│   │   └── common/             # Shared components
│   ├── pages/                  # Main pages
│   ├── hooks/                  # Custom React hooks
│   ├── utils/                  # Utility functions
│   └── styles/                 # Tailwind CSS styles
│
├── backend/                    # Python FastAPI server
│   ├── main.py                 # API entry point
│   ├── agent.py                # LLM agent logic
│   ├── memory.py               # Long-term memory handling
│   └── database.py             # SQLite database operations
│
├── mcp_tools/                  # MCP tool implementations
│   ├── application_db.py       # CRUD for applications
│   ├── program_research.py     # Web search for programs
│   ├── essay_analyzer.py       # SOP analysis tool
│   └── calendar_todo.py        # Calendar & to-do management
│
├── README.md                   # This file
├── requirements.txt            # Python dependencies
└── package.json                # Node.js dependencies
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/gradtrack-ai.git
   cd gradtrack-ai
   ```

2. **Set up the backend**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Add your API key**
   Create a `.env` file in the backend folder:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

4. **Set up the frontend**
   ```bash
   cd frontend
   npm install
   ```

5. **Run the application**

   Terminal 1 (Backend):
   ```bash
   cd backend
   python main.py
   ```

   Terminal 2 (Frontend):
   ```bash
   cd frontend
   npm run dev
   ```

6. **Open in browser**
   Go to `http://localhost:3000`

---

## 💬 Example Conversations

| You Say | AI Response |
|---------|-------------|
| "Add MIT EECS PhD to my list" | "Added MIT EECS PhD to your Researching column. The deadline is December 15. Would you like me to find more details about this program?" |
| "What GRE score do I need for Stanford?" | "Stanford CS doesn't require GRE scores as of 2024. However, a strong GRE can still help your application." |
| "Analyze my Berkeley SOP" | "Your SOP is 847 words. Strengths: Clear research interest. Suggestions: Add more specific faculty names and mention why Berkeley's program fits your goals." |
| "What deadlines do I have in December?" | "You have 3 deadlines in December: MIT (Dec 1), Stanford (Dec 5), Berkeley (Dec 15)." |
| "I got an interview at CMU!" | "Congratulations! 🎉 I've moved CMU to your Interview column. Would you like me to help you prepare with common PhD interview questions?" |
| "Create a to-do list for my Stanford app" | "Created a to-do list for Stanford: ☐ Write SOP draft, ☐ Request 3 LORs, ☐ Submit GRE scores, ☐ Complete online form. I've set reminders 1 week before the deadline!" |
| "What tasks are due this week?" | "You have 4 tasks due this week: 1) MIT SOP final draft (Dec 12), 2) Request Berkeley LOR (Dec 13), 3) Submit Stanford application (Dec 15), 4) CMU interview prep (Dec 16)." |
| "Mark my Stanford SOP as done" | "Great progress! ✅ Marked 'Stanford SOP draft' as complete. You've finished 3 of 5 tasks for your Stanford application!" |

---

## 📋 Database Schema

### Applications Table
| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Unique ID |
| school_name | String | Name of university |
| program_name | String | Name of program (e.g., "MS Computer Science") |
| degree_type | String | MS, PhD, etc. |
| deadline | Date | Application deadline |
| status | String | researching, in_progress, applied, interview, decision |
| decision | String | accepted, rejected, waitlisted, pending |
| notes | Text | Your personal notes |
| created_at | DateTime | When you added this |
| updated_at | DateTime | Last update time |

### User Profile Table
| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Unique ID |
| gpa | Float | Your GPA |
| gre_verbal | Integer | GRE Verbal score |
| gre_quant | Integer | GRE Quantitative score |
| major | String | Undergraduate major |
| research_interests | Text | Your research interests |
| preferred_locations | Text | Where you want to study |

### Tasks Table (New!)
| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Unique ID |
| application_id | Integer | Foreign key to Applications |
| title | String | Task title |
| description | Text | Task details |
| due_date | DateTime | When the task is due |
| priority | String | high, medium, low |
| status | String | pending, in_progress, completed |
| category | String | essay, lor, test_scores, forms, interview, other |
| reminder_date | DateTime | When to send reminder |
| created_at | DateTime | When task was created |
| completed_at | DateTime | When task was completed |

---

## 🎯 Future Improvements

- [ ] Google Calendar integration (sync deadlines)
- [ ] Email reminders for upcoming deadlines
- [ ] Faculty matching based on research interests
- [ ] Document checklist per school
- [ ] Compare schools side-by-side
- [ ] Mobile app version
- [ ] Push notifications for task reminders
- [ ] Recurring task templates
- [ ] Export tasks to external calendar apps

---

## 🤝 Contributing

This is a class project, but suggestions are welcome! Feel free to open an issue or submit a pull request.

---

## 📄 License

MIT License - feel free to use this for your own projects!

---

**Built with ❤️ for stressed grad school applicants everywhere.**
