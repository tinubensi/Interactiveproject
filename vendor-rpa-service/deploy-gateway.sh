#!/bin/bash

# RPA Gateway & Bot Deployment Script
# This script sets up the RPA gateway and bot servers on the VM

set -e

echo "========================================="
echo "RPA Gateway & Bot Servers Deployment"
echo "========================================="

# Navigate to vendor-rpa-service directory
cd /home/janees/Desktop/crm/Interactiveproject/vendor-rpa-service

echo ""
echo "Step 1: Installing Node.js dependencies..."
npm install

echo ""
echo "Step 2: Installing PM2 globally (if not already installed)..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    echo "✅ PM2 installed"
else
    echo "✅ PM2 already installed"
fi

echo ""
echo "Step 3: Stopping existing PM2 processes..."
pm2 stop all || true
pm2 delete all || true

echo ""
echo "Step 4: Starting RPA Gateway and Bot Servers..."
pm2 start ecosystem.config.js

echo ""
echo "Step 5: Saving PM2 process list..."
pm2 save

echo ""
echo "Step 6: Setting up PM2 startup script..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u janees --hp /home/janees || true

echo ""
echo "========================================="
echo "✅ Deployment Complete!"
echo "========================================="
echo ""
echo "Services running:"
pm2 list

echo ""
echo "Gateway URL: http://20.203.51.248/api/{vendor}/scrape"
echo ""
echo "Available endpoints:"
echo "  - http://20.203.51.248/api/alsagr/scrape"
echo "  - http://20.203.51.248/api/sukoon/scrape"
echo "  - http://20.203.51.248/api/takaful/scrape"
echo "  - http://20.203.51.248/api/watania/scrape"
echo ""
echo "To view logs:"
echo "  pm2 logs rpa-gateway"
echo "  pm2 logs alsagr-bot"
echo "  pm2 logs sukoon-bot"
echo ""
echo "To restart:"
echo "  pm2 restart all"
