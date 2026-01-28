# Gmail Integration Setup Guide

This guide will help you set up Gmail integration to automatically import grad school applications from your email.

## 🎯 What Email Integration Does

The email integration feature automatically:
- ✅ Scans your Gmail inbox for grad school application emails
- ✅ Detects application confirmations, deadlines, interviews, and decisions
- ✅ Extracts school names, programs, deadlines, and status
- ✅ Auto-creates applications in your tracker
- ✅ Updates application status based on new emails

**No more manual entry!** 🎉

---

## 📋 Prerequisites

1. A Gmail account with your grad school application emails
2. Google Cloud Platform (GCP) account (free)
3. Python 3.8+ installed
4. GradTrack AI backend running

---

## 🔧 Setup Instructions

### Step 1: Enable Gmail API in Google Cloud Console

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create a New Project** (or select existing)
   - Click "Select a project" → "New Project"
   - Name it: `GradTrack-AI-Email`
   - Click "Create"

3. **Enable Gmail API**
   - In the search bar, type "Gmail API"
   - Click on "Gmail API"
   - Click **"Enable"**

4. **Configure OAuth Consent Screen**
   - Go to: APIs & Services → OAuth consent screen
   - Select **"External"** (unless you have a Google Workspace account)
   - Click "Create"

   **Fill in the required fields:**
   - App name: `GradTrack AI`
   - User support email: Your email
   - Developer contact: Your email
   - Click "Save and Continue"

   **Scopes** (Step 2):
   - Click "Add or Remove Scopes"
   - Find and select: `https://www.googleapis.com/auth/gmail.readonly`
   - Click "Update" → "Save and Continue"

   **Test Users** (Step 3):
   - Click "Add Users"
   - Add your Gmail address
   - Click "Save and Continue"

5. **Create OAuth Credentials**
   - Go to: APIs & Services → Credentials
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: **Desktop app**
   - Name: `GradTrack AI Desktop`
   - Click "Create"

6. **Download Credentials**
   - Click the **Download** icon (↓) next to your newly created credentials
   - Save the file as `credentials.json`
   - Move `credentials.json` to your backend directory:
     ```bash
     mv ~/Downloads/client_secret_*.json /path/to/Project-GradApp-AI-Tracker/backend/credentials.json
     ```

---

### Step 2: Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This will install:
- `google-auth`
- `google-auth-oauthlib`
- `google-auth-httplib2`
- `google-api-python-client`
- `anthropic` (for AI email parsing)

---

### Step 3: Set Up Environment Variables

Create a `.env` file in your `backend/` directory:

```bash
cd backend
touch .env
```

Add your Anthropic API key (required for AI email parsing):

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

**Get an Anthropic API key:**
1. Sign up at: https://console.anthropic.com/
2. Go to API Keys → Create Key
3. Copy the key and paste it in `.env`

---

### Step 4: Test Email Integration

Test the email service directly:

```bash
cd backend
python email_service.py
```

**What happens:**
1. A browser window will open asking you to log in to Gmail
2. Grant GradTrack AI permission to read your emails
3. The service will scan your inbox for application emails
4. You'll see a summary of detected applications

**First-time authentication:**
- You may see a warning: "Google hasn't verified this app"
- Click "Advanced" → "Go to GradTrack AI (unsafe)"
- This is safe because it's your own app!

---

### Step 5: Start the Backend Server

```bash
cd backend
python main.py
```

The server should start at `http://localhost:8000`

---

### Step 6: Use Email Sync in the UI

1. **Start the frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Open GradTrack AI:**
   - Navigate to `http://localhost:3000`

3. **Click "Email Sync" button** in the header

4. **Connect Gmail:**
   - Click "Connect Gmail"
   - Authenticate (if not already done)
   - Choose time range (30 days, 90 days, 1 year, etc.)
   - Click "Scan Emails"

5. **Review Detected Applications:**
   - AI will analyze your emails and extract application data
   - Review the detected applications
   - Select which ones to import
   - Click "Import Applications"

6. **Done!** 🎉
   - Applications will appear on your Kanban board
   - The AI assistant will have context about them

---

## 🔍 What Emails Are Detected?

The email scanner looks for:

### 1. **Application Confirmations**
```
Subject: "Application Submitted - Stanford University"
From: admissions@stanford.edu
→ Creates: Stanford | MS Computer Science | Status: Applied
```

### 2. **Deadline Reminders**
```
Subject: "Reminder: PhD Application Deadline December 1st"
From: gradschool@mit.edu
→ Updates: Deadline and adds notes
```

### 3. **Interview Invitations**
```
Subject: "Interview Invitation - Carnegie Mellon University"
From: admissions@cmu.edu
→ Updates: Status to "Interview"
```

### 4. **Admission Decisions**
```
Subject: "Congratulations! Admission Offer - UC Berkeley"
From: admissions@berkeley.edu
→ Updates: Status to "Decision", Decision to "Accepted"
```

### 5. **Status Updates**
```
Subject: "Application Status Update"
From: gradschool@gatech.edu
→ Updates status based on email content
```

---

## 🎨 Supported Email Patterns

The AI parser recognizes emails from:
- **Application Portals:** ApplyWeb, Slate, Embark, Liaison CAS
- **University Domains:** Any .edu email
- **Common Keywords:** "graduate", "PhD", "Masters", "admission", "application"

---

## 🛡️ Privacy & Security

**Your data is safe:**
- ✅ We only read emails (no sending or deleting)
- ✅ OAuth authentication (not password-based)
- ✅ Credentials stored locally on your machine
- ✅ No data sent to third parties
- ✅ You can revoke access anytime at: https://myaccount.google.com/permissions

**Revoke access:**
1. Go to https://myaccount.google.com/permissions
2. Find "GradTrack AI"
3. Click "Remove Access"

---

## 🐛 Troubleshooting

### Issue: "Credentials file not found"
**Solution:** Make sure `credentials.json` is in the `backend/` directory

### Issue: "Gmail authentication failed"
**Solution:**
1. Delete `token.json` if it exists: `rm backend/token.json`
2. Run authentication again
3. Make sure you selected the correct Google account

### Issue: "No emails found"
**Solution:**
1. Increase the time range (try 1-2 years)
2. Check your Gmail inbox - do you have grad school emails?
3. Try searching Gmail manually for "graduate application"

### Issue: "API key error"
**Solution:** Make sure `ANTHROPIC_API_KEY` is set in `backend/.env`

### Issue: "Google hasn't verified this app"
**Solution:** This is expected for personal apps. Click "Advanced" → "Go to GradTrack AI"

---

## 📊 Example Output

After scanning 365 days:

```
🔍 Scanning emails from last 365 days...
📧 Found 47 total emails to analyze
Analyzing email 47/47...

✅ Found 12 application-related emails

📊 Summary:
Total applications found: 12

- Stanford University - MS Computer Science
  Status: applied
  Type: confirmation

- MIT - PhD Computer Science
  Status: interview
  Type: interview_invite

- UC Berkeley - PhD EECS
  Status: decision
  Type: decision (Accepted!)

... (9 more)
```

---

## 🚀 Advanced Usage

### Customize Search Queries

Edit `email_service.py` to add custom search patterns:

```python
def get_application_search_queries(self):
    return [
        'subject:(specific university name)',
        'from:(specific-admissions@university.edu)',
        # Add your custom queries
    ]
```

### Auto-Import on Schedule

Set up a cron job to auto-import daily:

```bash
# Run email sync every day at 9 AM
0 9 * * * cd /path/to/backend && python email_service.py
```

### Batch Import via API

Use the API directly:

```bash
# Scan and auto-import all emails
curl -X POST "http://localhost:8000/api/email/import?days_back=365&auto_import=true"
```

---

## ✅ Checklist

Before using email sync, make sure:

- [ ] Gmail API is enabled in Google Cloud Console
- [ ] OAuth consent screen is configured
- [ ] `credentials.json` is in `backend/` directory
- [ ] `ANTHROPIC_API_KEY` is in `backend/.env`
- [ ] Python dependencies are installed
- [ ] Backend server is running on port 8000
- [ ] Frontend is running on port 3000

---

## 🎉 Success!

You're all set! Now you can:
1. Click "Email Sync" in the header
2. Scan your inbox automatically
3. Import applications with one click
4. Keep everything synced 🚀

**Never manually enter another application!** 🎊

---

## 📞 Need Help?

If you run into issues:
1. Check the troubleshooting section above
2. Look at backend logs: `backend/email_service.py` output
3. Verify Gmail API quota (usually 1 billion requests/day - you're fine!)
4. Check that credentials.json is valid JSON

---

## 📚 Additional Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Anthropic API Docs](https://docs.anthropic.com/)

Happy tracking! 🎓✨
