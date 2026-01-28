# 🚀 Quick Start - Email Integration

## ⏱️ Time Required: ~20 minutes (one-time setup)

---

## ✅ Checklist - What You Need

- [ ] **Google Cloud Console account** (free)
- [ ] **Anthropic API key** (free tier available)
- [ ] **Gmail account** with your grad school emails

---

## 📝 Step-by-Step Setup

### **STEP 1: Get Gmail API Credentials** (15 min)

**A. Go to Google Cloud Console**
```
https://console.cloud.google.com/
```

**B. Create a Project**
- Click "Select a project" → "New Project"
- Name: `GradTrack-AI-Email`
- Click "Create"

**C. Enable Gmail API**
1. In the search bar, type: `Gmail API`
2. Click on "Gmail API"
3. Click **"Enable"**

**D. Configure OAuth Consent Screen**
1. Go to: `APIs & Services` → `OAuth consent screen`
2. Select **"External"**
3. Click "Create"
4. Fill in:
   - **App name:** `GradTrack AI`
   - **User support email:** Your email
   - **Developer contact:** Your email
5. Click "Save and Continue"

6. **Scopes** page:
   - Click "Add or Remove Scopes"
   - Search for: `gmail.readonly`
   - Select: `https://www.googleapis.com/auth/gmail.readonly`
   - Click "Update"
   - Click "Save and Continue"

7. **Test Users** page:
   - Click "Add Users"
   - Enter your Gmail address
   - Click "Add"
   - Click "Save and Continue"

**E. Create OAuth Credentials**
1. Go to: `APIs & Services` → `Credentials`
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Desktop app**
4. Name: `GradTrack AI Desktop`
5. Click "Create"

**F. Download Credentials**
1. Find your new credentials in the list
2. Click the **Download** icon (↓)
3. Save the file
4. **Rename it to:** `credentials.json`
5. **Move it to:** `backend/credentials.json`

```bash
# Example command (adjust path as needed):
mv ~/Downloads/client_secret_*.json backend/credentials.json
```

---

### **STEP 2: Get Anthropic API Key** (2 min)

**A. Sign up for Anthropic**
```
https://console.anthropic.com/
```

**B. Create API Key**
1. Log in
2. Go to: `API Keys`
3. Click "Create Key"
4. Copy the key (starts with `sk-ant-...`)

**C. Add to .env file**

```bash
# Create .env file in backend directory
cd backend
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env
```

**Replace `sk-ant-your-key-here` with your actual key!**

---

### **STEP 3: Install Dependencies** (3 min)

```bash
cd backend
pip install -r requirements.txt
```

This installs:
- `google-auth` - Gmail authentication
- `google-api-python-client` - Gmail API
- `anthropic` - AI email parsing

---

### **STEP 4: Verify Setup**

Run the setup checker:

```bash
cd /home/user/Project-GradApp-AI-Tracker
./setup_email.sh
```

You should see:
```
✅ Gmail credentials: Ready
✅ Anthropic API key: Ready
🎉 You're all set!
```

---

## 🎯 Running the App

### **Terminal 1: Start Backend**

```bash
cd backend
python main.py
```

You should see:
```
🚀 Starting GradTrack AI Backend...
✅ Database and memory systems initialized
INFO: Uvicorn running on http://0.0.0.0:8000
```

### **Terminal 2: Start Frontend**

```bash
cd frontend
npm run dev
```

You should see:
```
VITE v5.4.21  ready in 355 ms
➜  Local:   http://localhost:3000/
```

---

## 🧪 Test Email Integration

1. **Open browser:** `http://localhost:3000`

2. **Click "Email Sync"** button in header (blue envelope icon)

3. **First time only:**
   - Browser window opens
   - Log in to Gmail
   - You'll see: "Google hasn't verified this app"
   - Click "Advanced" → "Go to GradTrack AI (unsafe)"
   - This is safe - it's YOUR app!
   - Click "Allow"

4. **Choose time range:**
   - Select "365 days (1 year)"

5. **Click "Scan Emails"**
   - AI will analyze your inbox (~30-60 seconds)

6. **Review detected applications:**
   - Check the list
   - Select which ones to import
   - Click "Import Applications"

7. **Done!** 🎉
   - Applications appear on your Kanban board

---

## 🔍 What Gets Detected?

The AI looks for emails like:

### ✉️ Application Confirmations
```
Subject: "Application Submitted - Stanford University"
From: admissions@stanford.edu

→ Creates: Stanford | MS CS | Status: Applied
```

### ✉️ Interview Invitations
```
Subject: "Interview Invitation - MIT"
From: gradschool@mit.edu

→ Updates: Status to Interview
```

### ✉️ Admission Decisions
```
Subject: "Congratulations! UC Berkeley"
From: admissions@berkeley.edu

→ Updates: Status to Decision (Accepted)
```

---

## ❓ Troubleshooting

### **"Credentials file not found"**
**Fix:** Make sure `credentials.json` is in `backend/` directory
```bash
ls backend/credentials.json
```

### **"Gmail authentication failed"**
**Fix:** Delete token and re-authenticate
```bash
rm backend/token.json
# Then try Email Sync again
```

### **"No emails found"**
**Fix:**
- Increase time range (try 2 years)
- Check if you have grad school emails in your Gmail
- Search Gmail manually for "graduate application"

### **"API key error"**
**Fix:** Check `.env` file
```bash
cat backend/.env
# Should show: ANTHROPIC_API_KEY=sk-ant-...
```

### **"Google hasn't verified this app"**
**Fix:** This is expected!
- Click "Advanced"
- Click "Go to GradTrack AI (unsafe)"
- It's safe because it's YOUR app

---

## 🎉 Success Indicators

You'll know it's working when:

1. ✅ Backend starts without errors
2. ✅ Frontend loads at `http://localhost:3000`
3. ✅ "Email Sync" button appears in header
4. ✅ Clicking it opens the modal
5. ✅ Gmail authentication succeeds
6. ✅ Emails are scanned and applications appear

---

## 📊 Expected Results

After scanning 1 year of emails, you might see:

```
🔍 Scanning emails from last 365 days...
📧 Found 47 total emails to analyze
✅ Found 12 application-related emails

Applications detected:
- Stanford University - MS Computer Science
- MIT - PhD Computer Science
- UC Berkeley - PhD EECS
- Carnegie Mellon - MS Machine Learning
... (8 more)
```

---

## 🔐 Privacy & Security

**Your data is safe:**
- ✅ Read-only Gmail access (can't send/delete)
- ✅ OAuth authentication (not password-based)
- ✅ Credentials stored locally on YOUR machine
- ✅ No data sent to third parties
- ✅ You can revoke access anytime

**To revoke access:**
1. Go to: https://myaccount.google.com/permissions
2. Find "GradTrack AI"
3. Click "Remove Access"

---

## 📚 More Help

**Detailed documentation:**
- `GMAIL_SETUP.md` - Full setup guide with screenshots
- `EMAIL_INTEGRATION_README.md` - Feature overview

**Test the backend directly:**
```bash
cd backend
python email_service.py
```

**Check API status:**
```bash
curl http://localhost:8000/api/email/status
```

---

## 💡 Pro Tips

**First scan:**
- Start with 90 days to test
- Review carefully before importing
- Check for duplicates

**Regular use:**
- Run weekly to catch new emails
- Use 30-day scans for updates
- AI improves with more data

**Advanced:**
```bash
# Auto-import without UI
curl -X POST "http://localhost:8000/api/email/import?days_back=365&auto_import=true"
```

---

## ✅ Final Checklist

Before asking for help, verify:

- [ ] `backend/credentials.json` exists
- [ ] `backend/.env` has `ANTHROPIC_API_KEY`
- [ ] Dependencies installed (`pip install -r requirements.txt`)
- [ ] Backend running on port 8000
- [ ] Frontend running on port 3000
- [ ] No firewall blocking ports

---

**Ready to go? Start here:**

```bash
# Terminal 1
cd backend
python main.py

# Terminal 2
cd frontend
npm run dev

# Browser
open http://localhost:3000
```

**Click "Email Sync" and let the magic happen! 🎊**
