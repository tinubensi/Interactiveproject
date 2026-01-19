#!/bin/bash
# Quick Setup Script for Sukoon Integration

echo "==================================="
echo "Sukoon Vendor Integration - Setup"
echo "==================================="

# Step 1: Add credentials
echo ""
echo "Step 1: Add credentials to config/credentials.json"
echo "Copy this block into the file:"
echo ""
cat << 'EOF'
  "vendor-sukoon": {
    "username": "individualmedical@iibcare.com",
    "password": "Interactive@2025",
    "portal_url": "https://individualonline.sukoon.com/SignIn?ReturnUrl=%2Fhealth-insurance%2FHome"
  }
EOF

echo ""
read -p "Press Enter once credentials are added..."

# Step 2: Make CLI executable
echo ""
echo "Step 2: Making CLI executable..."
chmod +x vendors/sukoon/cli.py
echo "✓ Done"

# Step 3: Test CLI
echo ""
echo "Step 3: Testing CLI..."
python3 vendors/sukoon/cli.py --lead-data '{
  "id": "test-sukoon-setup",
  "dateOfBirth": "1996-06-15",
  "gender": "male",
  "lobData": {
    "dateOfBirth": "1996-06-15",
    "gender": "male",
    "visaType": "citizen",
    "nationality": "UAE",
    "maritalStatus": "single"
  }
}' 2>&1 | head -20

echo ""
echo "If you see plans JSON above, CLI test passed!"
read -p "Press Enter to continue..."

# Step 4: Test Node.js server
echo ""
echo "Step 4: Testing Node.js server..."
echo "Starting server in background..."
node bots/sukoon/server.js > /tmp/sukoon-server.log 2>&1 &
SERVER_PID=$!
sleep 2

echo "Testing health endpoint..."
curl -s http://localhost:3004/health | python3 -m json.tool

echo ""
echo "Server started with PID: $SERVER_PID"
echo "Logs: tail -f /tmp/sukoon-server.log"
echo ""
read -p "Press Enter to stop test server..."
kill $SERVER_PID 2>/dev/null

# Step 5: PM2 setup
echo ""
echo "Step 5: PM2 Production Setup"
echo ""
echo "Run these commands to start with PM2:"
echo ""
echo "  pm2 start ecosystem.config.js --only sukoon-bot"
echo "  pm2 save"
echo "  pm2 list"
echo ""

echo "==================================="
echo "Setup Complete!"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Add credentials to config/credentials.json"
echo "2. Start PM2: pm2 start ecosystem.config.js --only sukoon-bot"
echo "3. Test: curl -X POST http://localhost:3004/scrape -H 'Content-Type: application/json' -d '{\"leadData\":{\"id\":\"test\",\"dateOfBirth\":\"1996-06-15\",\"gender\":\"male\"}}'"
echo ""
echo "Documentation:"
echo "- SUKOON_INTEGRATION_COMPLETE.md"
echo "- SUKOON_TESTING_GUIDE.md"
echo ""
