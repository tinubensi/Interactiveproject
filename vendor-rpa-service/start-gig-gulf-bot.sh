#!/bin/bash

# Script to start gig-gulf-bot if not running
# Run this on the RPA VM: rpauser@rpa-vm-production

echo "========================================="
echo "GIG Gulf Bot - Status Check & Start"
echo "========================================="

# Check if bot is running
pm2 list | grep -q "gig-gulf-bot"

if [ $? -eq 0 ]; then
    echo "✅ gig-gulf-bot is already running"
    pm2 list | grep "gig-gulf-bot"
    echo ""
    echo "To view logs:"
    echo "  pm2 logs gig-gulf-bot"
    echo ""
    echo "To restart:"
    echo "  pm2 restart gig-gulf-bot"
else
    echo "❌ gig-gulf-bot is NOT running"
    echo ""
    echo "Starting gig-gulf-bot..."
    
    # Navigate to vendor-rpa-service directory
    cd /home/rpauser/Desktop/crm/Interactiveproject/vendor-rpa-service || cd ~/vendor-rpa-service || cd /home/rpauser/vendor-rpa-service
    
    if [ ! -f "ecosystem.config.js" ]; then
        echo "❌ ERROR: ecosystem.config.js not found!"
        echo "Current directory: $(pwd)"
        echo "Please navigate to vendor-rpa-service directory"
        exit 1
    fi
    
    # Start only gig-gulf-bot
    pm2 start ecosystem.config.js --only gig-gulf-bot
    
    # Save PM2 process list
    pm2 save
    
    echo ""
    echo "✅ gig-gulf-bot started!"
    echo ""
    echo "Status:"
    pm2 list | grep "gig-gulf-bot"
    echo ""
    echo "To view logs:"
    echo "  pm2 logs gig-gulf-bot"
    echo ""
    echo "To check health:"
    echo "  curl http://localhost:3005/health"
fi

echo ""
echo "========================================="
