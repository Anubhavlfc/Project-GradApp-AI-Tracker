# 🚀 How to Run GradTrack AI

## ✅ Current Status

**Both servers ARE running successfully in Claude Code environment:**

- ✅ Backend (FastAPI): Port 8000
- ✅ Frontend (Vite/React): Port 3000
- ✅ All 4 MCP tools working
- ✅ 6 demo applications loaded
- ✅ AI chat using Claude 3.5 Sonnet

## ⚠️ Port Access Issue

You're getting `ERR_CONNECTION_REFUSED` because:
- The servers run in a **remote Claude Code container**
- You're trying to access `localhost:3000` from **your local browser**
- These are different environments!

---

## 🌐 Option 1: Access via Port Forwarding (Recommended)

Claude Code should automatically forward ports. Look for:

1. **Port forwarding notification** in Claude Code
2. **"Open in Browser" button** near the terminal
3. **Auto-generated URLs** like:
   - `https://xxx-3000.app.github.dev` (Frontend)
   - `https://xxx-8000.app.github.dev` (Backend)

Click those URLs to access your application!

---

## 💻 Option 2: Run Locally on Your Machine

If you want to run it on your actual computer:

### 1. Clone the repository
```bash
git clone https://github.com/Anubhavlfc/Project-GradApp-AI-Tracker.git
cd Project-GradApp-AI-Tracker
```

### 2. Set up backend
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
echo "OPENROUTER_API_KEY=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" > .env

# Run backend
python main.py
```

Backend will run at: **http://localhost:8000**

### 3. Set up frontend (in a new terminal)
```bash
cd frontend

# Install dependencies
npm install

# Run frontend
npm run dev
```

Frontend will run at: **http://localhost:3000**

### 4. Open in browser
```
http://localhost:3000
```

You should see the beautiful UI with 6 applications!

---

## 🧪 Verify Everything Works (API Tests)

Even in Claude Code, you can test the API:

### Get all applications
```bash
curl http://localhost:8000/api/applications | jq .
```

### Get program recommendations
```bash
curl -X POST "http://localhost:8000/api/tools/program-recommender?action=get_recommendations&num_recommendations=5" | jq .
```

### Research a program
```bash
curl -X POST "http://localhost:8000/api/tools/research-automation?action=batch_research" | jq .
```

### Analyze decisions
```bash
curl -X POST "http://localhost:8000/api/tools/decision-analyzer?action=get_insights" | jq .
```

### Check email monitor status
```bash
curl -X POST "http://localhost:8000/api/tools/email-monitor?action=get_status" | jq .
```

---

## 📊 What You'll See

### Kanban Board (6 Applications)

**🔍 Researching:**
- Stanford CS (MS) - Auto-researched with deadline 2025-12-01

**📝 In Progress:**
- Carnegie Mellon ML (MS) - Deadline 2025-12-10

**✉️ Applied:**
- UC Berkeley CS (PhD) - Deadline 2025-12-15

**🎤 Interview:**
- University of Washington CS (MS)

**🎯 Decision:**
- MIT CS (MS) - **ACCEPTED** ✅
- Georgia Tech CS (MS) - **WAITLISTED** ⏳

---

## 🤖 MCP Tools Available

All working and tested:

1. **📧 Email Monitor** - Auto-check email for updates
2. **🎯 Program Recommender** - AI-powered program suggestions
3. **🔍 Research Automation** - Auto-research programs
4. **📊 Decision Analyzer** - Analyze decisions and get insights

---

## 🎨 UI Features

- Beautiful gradient backgrounds
- Glassmorphism cards with blur effects
- Smooth drag-and-drop
- Glow effects on hover
- Animated transitions
- Modern color palette

---

## 📝 Quick Commands

### Stop servers
```bash
pkill -f "python main.py"
pkill -f "vite"
```

### Restart servers
```bash
# Backend
cd backend && python main.py &

# Frontend
cd frontend && npm run dev &
```

### View logs
```bash
# Backend
tail -f /tmp/backend.log

# Frontend
tail -f /tmp/frontend.log
```

---

## 🆘 Troubleshooting

### "Connection refused"
- You're trying to access from outside Claude Code
- Use port forwarding URLs or run locally

### "Module not found"
```bash
cd backend
pip install -r requirements.txt
```

### Frontend won't start
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### API not responding
```bash
# Check backend is running
curl http://localhost:8000/api/health

# Restart if needed
pkill -f "python main.py"
cd backend && python main.py &
```

---

## ✨ Summary

**Everything is working!** The only issue is accessing it from your browser.

- **In Claude Code**: Use port forwarding URLs
- **On your machine**: Clone repo and run locally

All MCP tools, AI features, and the beautiful UI are ready to use! 🎉
