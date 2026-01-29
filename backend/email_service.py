"""
Email Integration Service for GradTrack AI

Automatically detects and tracks graduate school applications from email.
Supports Gmail integration with AI-powered email parsing.
"""

import os
import json
import re
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from openai import OpenAI
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import base64

# Gmail API scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

# Get the directory where this file is located (backend folder)
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))

# Check if running in production (Render sets this)
IS_PRODUCTION = os.getenv('RENDER') is not None or os.getenv('IS_PRODUCTION') == 'true'

class EmailIntegrationService:
    """Service for integrating with Gmail to auto-detect applications."""

    def __init__(self, api_key: str = None):
        """Initialize the email service."""
        self.api_key = api_key or os.getenv('OPENAI_API_KEY') or os.getenv('OPENROUTER_API_KEY') or os.getenv('ANTHROPIC_API_KEY')
        if not self.api_key:
            print("⚠️ No API key found. Email parsing will not work without OPENAI_API_KEY in .env")
            self.client = None
        else:
            # Use OpenRouter which supports multiple models including Claude
            self.client = OpenAI(
                api_key=self.api_key,
                base_url="https://openrouter.ai/api/v1"
            )
        self.gmail_service = None
        self.is_production = IS_PRODUCTION

    def authenticate_gmail(self, credentials_path: str = None,
                          token_path: str = None) -> bool:
        """
        Authenticate with Gmail API.

        Args:
            credentials_path: Path to OAuth credentials JSON file
            token_path: Path to store access token

        Returns:
            True if authentication successful, False otherwise
        """
        # In production, Gmail OAuth desktop flow doesn't work
        if self.is_production:
            print("⚠️ Gmail OAuth is not available in production deployment.")
            print("   Email sync requires running the app locally.")
            raise Exception("Gmail email sync is not available in the deployed version. Please run the app locally to use email sync, or manually add applications using the 'Add Application' button.")
        
        # Use absolute paths based on the backend directory
        if credentials_path is None:
            credentials_path = os.path.join(BACKEND_DIR, 'credentials.json')
        if token_path is None:
            token_path = os.path.join(BACKEND_DIR, 'token.json')
        
        creds = None

        # Check if token already exists
        if os.path.exists(token_path):
            creds = Credentials.from_authorized_user_file(token_path, SCOPES)

        # If no valid credentials, let user log in
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists(credentials_path):
                    print(f"❌ Credentials file not found: {credentials_path}")
                    print("\n📝 Setup Instructions:")
                    print("1. Go to https://console.cloud.google.com/")
                    print("2. Create a new project (or select existing)")
                    print("3. Enable Gmail API")
                    print("4. Create OAuth 2.0 credentials (Desktop app)")
                    print("5. Download credentials.json to backend folder")
                    return False

                flow = InstalledAppFlow.from_client_secrets_file(
                    credentials_path, SCOPES)
                creds = flow.run_local_server(port=0)

            # Save credentials for next run
            with open(token_path, 'w') as token:
                token.write(creds.to_json())

        try:
            self.gmail_service = build('gmail', 'v1', credentials=creds)
            print("✅ Gmail authentication successful!")
            return True
        except HttpError as error:
            print(f"❌ Gmail authentication failed: {error}")
            return False

    def search_emails(self, query: str, max_results: int = 100,
                     days_back: int = 365) -> List[Dict]:
        """
        Search emails using Gmail query syntax.

        Args:
            query: Gmail search query
            max_results: Maximum number of emails to retrieve
            days_back: How many days back to search

        Returns:
            List of email messages
        """
        if not self.gmail_service:
            raise Exception("Gmail service not authenticated. Call authenticate_gmail() first.")

        # Calculate date filter
        after_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y/%m/%d')
        full_query = f"{query} after:{after_date}"

        try:
            results = self.gmail_service.users().messages().list(
                userId='me',
                q=full_query,
                maxResults=max_results
            ).execute()

            messages = results.get('messages', [])

            if not messages:
                print(f"No emails found matching query: {full_query}")
                return []

            print(f"✅ Found {len(messages)} emails matching query")
            return messages

        except HttpError as error:
            print(f"❌ Error searching emails: {error}")
            return []

    def get_email_content(self, message_id: str) -> Optional[Dict]:
        """
        Get full email content by message ID.

        Args:
            message_id: Gmail message ID

        Returns:
            Dictionary with email details
        """
        if not self.gmail_service:
            raise Exception("Gmail service not authenticated.")

        try:
            message = self.gmail_service.users().messages().get(
                userId='me',
                id=message_id,
                format='full'
            ).execute()

            # Extract headers
            headers = message['payload']['headers']
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), '')
            sender = next((h['value'] for h in headers if h['name'] == 'From'), '')
            date = next((h['value'] for h in headers if h['name'] == 'Date'), '')

            # Extract body
            body = self._extract_body(message['payload'])

            return {
                'id': message_id,
                'subject': subject,
                'from': sender,
                'date': date,
                'body': body,
                'snippet': message.get('snippet', '')
            }

        except HttpError as error:
            print(f"❌ Error fetching email {message_id}: {error}")
            return None

    def _extract_body(self, payload: Dict) -> str:
        """Extract email body from payload."""
        body = ""

        if 'parts' in payload:
            for part in payload['parts']:
                if part['mimeType'] == 'text/plain':
                    if 'data' in part['body']:
                        body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                        break
                elif 'parts' in part:
                    body = self._extract_body(part)
                    if body:
                        break
        elif 'body' in payload and 'data' in payload['body']:
            body = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')

        return body

    def parse_application_email(self, email: Dict) -> Optional[Dict]:
        """
        Use AI to parse application information from email.

        Args:
            email: Email dictionary with subject, body, etc.

        Returns:
            Parsed application data or None if not an application email
        """
        prompt = f"""You are an expert at parsing graduate school application emails.

Analyze this email and determine if it's related to a graduate school application.

EMAIL SUBJECT: {email['subject']}
EMAIL FROM: {email['from']}
EMAIL BODY:
{email['body'][:2000]}  # First 2000 chars

Your task:
1. Determine if this is a graduate school application-related email
2. If yes, extract the following information:
   - school_name: University name (e.g., "Stanford University", "MIT")
   - program_name: Program name (e.g., "Computer Science", "Electrical Engineering")
   - degree_type: Degree type (PhD, MS, MBA, MEng, MA, or Other)
   - status: Application status (researching, in_progress, applied, interview, decision)
   - deadline: Application deadline if mentioned (YYYY-MM-DD format)
   - decision: If a decision email (accepted, rejected, waitlisted, or null)
   - email_type: Type of email (confirmation, deadline_reminder, interview_invite, decision, status_update, or other)

Respond ONLY with valid JSON in this format:
{{
  "is_application_email": true/false,
  "school_name": "...",
  "program_name": "...",
  "degree_type": "...",
  "status": "...",
  "deadline": "...",
  "decision": null or "accepted/rejected/waitlisted",
  "email_type": "...",
  "confidence": 0-100,
  "notes": "Any additional relevant info from the email"
}}

If not an application email, respond:
{{"is_application_email": false}}
"""

        try:
            response = self.client.chat.completions.create(
                model="anthropic/claude-3.5-sonnet",  # OpenRouter model name
                max_tokens=1000,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )

            # Extract JSON from response
            result_text = response.choices[0].message.content.strip()

            # Try to find JSON in the response
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())

                if result.get('is_application_email', False):
                    print(f"✅ Detected application: {result.get('school_name')} - {result.get('program_name')}")
                    return result
                else:
                    return None
            else:
                print("⚠️  Could not parse AI response as JSON")
                return None

        except Exception as e:
            print(f"❌ Error parsing email with AI: {e}")
            return None

    def scan_for_applications(self, days_back: int = 365) -> List[Dict]:
        """
        Scan inbox for graduate school application emails.

        Args:
            days_back: How many days back to search

        Returns:
            List of parsed application data
        """
        print(f"\n🔍 Scanning emails from last {days_back} days...")

        # Search queries for different types of application emails
        queries = [
            'graduate application',
            'grad school application',
            'PhD application',
            'Masters application',
            'application submitted',
            'application confirmation',
            'interview invitation',
            'admission decision',
            'congratulations admission',
            'graduate program',
            'application deadline',
        ]

        all_email_ids = set()

        # Search for each query
        for query in queries:
            messages = self.search_emails(query, max_results=50, days_back=days_back)
            for msg in messages:
                all_email_ids.add(msg['id'])

        print(f"📧 Found {len(all_email_ids)} total emails to analyze")

        # Parse each email
        applications = []
        for idx, email_id in enumerate(all_email_ids, 1):
            print(f"Analyzing email {idx}/{len(all_email_ids)}...", end='\r')

            email = self.get_email_content(email_id)
            if email:
                parsed = self.parse_application_email(email)
                if parsed:
                    applications.append(parsed)

        print(f"\n✅ Found {len(applications)} application-related emails")
        return applications

    def get_application_search_queries(self) -> List[str]:
        """Get list of search queries for finding application emails."""
        return [
            # Confirmation emails
            'subject:(application submitted OR application received OR confirmation)',

            # Deadline reminders
            'subject:(deadline OR due date) graduate',

            # Interview invitations
            'subject:(interview OR interview invitation)',

            # Decisions
            'subject:(admission decision OR congratulations OR unfortunately) graduate',

            # Status updates
            'subject:(application status OR status update) graduate',

            # Common application portals
            'from:(applyweb.com OR slate.com OR embark.com OR liaisoncas.com)',

            # University domains
            'from:(.edu) subject:(graduate OR PhD OR Masters OR MS OR MBA)',
        ]


def test_email_service():
    """Test the email integration service."""
    service = EmailIntegrationService()

    # Try to authenticate
    if service.authenticate_gmail():
        print("\n✅ Gmail authentication successful!")

        # Scan for applications
        applications = service.scan_for_applications(days_back=365)

        print(f"\n📊 Summary:")
        print(f"Total applications found: {len(applications)}")

        for app in applications:
            print(f"\n- {app.get('school_name')} - {app.get('program_name')}")
            print(f"  Status: {app.get('status')}")
            print(f"  Type: {app.get('email_type')}")
            if app.get('deadline'):
                print(f"  Deadline: {app.get('deadline')}")
    else:
        print("\n❌ Gmail authentication failed. Please set up credentials.")


if __name__ == "__main__":
    test_email_service()
