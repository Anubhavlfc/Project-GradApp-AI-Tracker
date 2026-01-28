#!/bin/bash

# Quick Setup Script for Gmail Integration
# This script will guide you through the setup process

echo "=================================================="
echo "  GradTrack AI - Email Integration Setup"
echo "=================================================="
echo ""

# Step 1: Check if credentials.json exists
echo "Step 1: Checking for Gmail credentials..."
if [ -f "backend/credentials.json" ]; then
    echo "✅ credentials.json found!"
else
    echo "❌ credentials.json NOT found"
    echo ""
    echo "You need to create it by following these steps:"
    echo ""
    echo "1. Go to: https://console.cloud.google.com/"
    echo "2. Create a new project (or select existing)"
    echo "3. Enable Gmail API:"
    echo "   - Search for 'Gmail API' in the search bar"
    echo "   - Click 'Enable'"
    echo ""
    echo "4. Configure OAuth Consent Screen:"
    echo "   - Go to: APIs & Services → OAuth consent screen"
    echo "   - Select 'External'"
    echo "   - Fill in:"
    echo "     * App name: GradTrack AI"
    echo "     * User support email: your email"
    echo "     * Developer contact: your email"
    echo "   - Click 'Save and Continue'"
    echo ""
    echo "   - Scopes page:"
    echo "     * Click 'Add or Remove Scopes'"
    echo "     * Find: https://www.googleapis.com/auth/gmail.readonly"
    echo "     * Click 'Update' → 'Save and Continue'"
    echo ""
    echo "   - Test Users page:"
    echo "     * Click 'Add Users'"
    echo "     * Add your Gmail address"
    echo "     * Click 'Save and Continue'"
    echo ""
    echo "5. Create OAuth Credentials:"
    echo "   - Go to: APIs & Services → Credentials"
    echo "   - Click 'Create Credentials' → 'OAuth client ID'"
    echo "   - Application type: Desktop app"
    echo "   - Name: GradTrack AI Desktop"
    echo "   - Click 'Create'"
    echo ""
    echo "6. Download credentials:"
    echo "   - Click the Download icon (↓) next to your credentials"
    echo "   - Save as 'credentials.json'"
    echo "   - Move to: $(pwd)/backend/credentials.json"
    echo ""
    echo "Press Enter when you've downloaded credentials.json..."
    read
fi

echo ""

# Step 2: Check for Anthropic API key
echo "Step 2: Checking for Anthropic API key..."
if [ -f "backend/.env" ] && grep -q "ANTHROPIC_API_KEY" backend/.env; then
    echo "✅ ANTHROPIC_API_KEY found in .env"
else
    echo "❌ ANTHROPIC_API_KEY NOT found"
    echo ""
    echo "You need to add it:"
    echo ""
    echo "1. Get API key from: https://console.anthropic.com/"
    echo "   - Sign up or log in"
    echo "   - Go to: API Keys → Create Key"
    echo "   - Copy the key"
    echo ""
    echo "2. Create backend/.env file:"
    echo "   echo 'ANTHROPIC_API_KEY=your_key_here' > backend/.env"
    echo ""
    echo "Enter your Anthropic API key (or press Enter to skip):"
    read api_key

    if [ ! -z "$api_key" ]; then
        echo "ANTHROPIC_API_KEY=$api_key" > backend/.env
        echo "✅ API key saved to backend/.env"
    fi
fi

echo ""

# Step 3: Check dependencies
echo "Step 3: Checking Python dependencies..."
if python3 -c "import google.auth" 2>/dev/null; then
    echo "✅ Gmail API dependencies installed"
else
    echo "❌ Dependencies not installed"
    echo "Installing now..."
    cd backend && pip install -r requirements.txt
fi

echo ""

# Summary
echo "=================================================="
echo "  Setup Summary"
echo "=================================================="
echo ""

if [ -f "backend/credentials.json" ]; then
    echo "✅ Gmail credentials: Ready"
else
    echo "❌ Gmail credentials: Missing"
fi

if [ -f "backend/.env" ] && grep -q "ANTHROPIC_API_KEY" backend/.env; then
    echo "✅ Anthropic API key: Ready"
else
    echo "❌ Anthropic API key: Missing"
fi

echo ""
echo "=================================================="
echo ""

if [ -f "backend/credentials.json" ] && [ -f "backend/.env" ]; then
    echo "🎉 You're all set! Ready to use email integration!"
    echo ""
    echo "Next steps:"
    echo "1. Start backend: cd backend && python main.py"
    echo "2. Start frontend: cd frontend && npm run dev"
    echo "3. Click 'Email Sync' button in the UI"
else
    echo "⚠️  Please complete the missing steps above"
    echo ""
    echo "For detailed instructions, see:"
    echo "  cat GMAIL_SETUP.md"
fi

echo ""
