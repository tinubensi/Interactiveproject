#!/bin/bash
# Deploy EMAF PDF Service to Azure VM
# This script deploys the PDF generation service to your Azure VM using pm2

set -e

# Configuration
VM_IP="20.203.51.248"
VM_USER="rpauser"
SSH_KEY="$HOME/.ssh/vm_rpa_key"
SERVICE_DIR="/home/rpauser/emaf-pdf-service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Deploying EMAF PDF Service to Azure VM${NC}"
echo "======================================"
echo ""

# Step 1: Test SSH connection
echo -e "${YELLOW}Step 1: Testing SSH connection...${NC}"
ssh -i ${SSH_KEY} -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${VM_USER}@${VM_IP} "echo 'SSH connection successful!'" || {
    echo -e "${RED}❌ SSH connection failed!${NC}"
    echo ""
    echo "Please ensure:"
    echo "1. You have SSH access to the VM"
    echo "2. Your SSH key is configured"
    echo "3. VM firewall allows SSH (port 22)"
    exit 1
}
echo -e "${GREEN}✅ SSH connection successful${NC}"
echo ""

# Step 2: Create service directory
echo -e "${YELLOW}Step 2: Creating service directory...${NC}"
ssh -i ${SSH_KEY} ${VM_USER}@${VM_IP} "mkdir -p ${SERVICE_DIR}"
echo -e "${GREEN}✅ Directory created${NC}"
echo ""

# Step 3: Copy files via rsync
echo -e "${YELLOW}Step 3: Copying files to VM...${NC}"
rsync -avz -e "ssh -i ${SSH_KEY}" --exclude 'node_modules' --exclude 'dist' --exclude '.git' \
  ${SCRIPT_DIR}/ ${VM_USER}@${VM_IP}:${SERVICE_DIR}/
echo -e "${GREEN}✅ Files copied${NC}"
echo ""

# Step 4: Install dependencies and build
echo -e "${YELLOW}Step 4: Installing dependencies and building...${NC}"
ssh -i ${SSH_KEY} ${VM_USER}@${VM_IP} "cd ${SERVICE_DIR} && npm install --production && npm run build"
echo -e "${GREEN}✅ Build completed${NC}"
echo ""

# Step 5: Install Playwright browsers
echo -e "${YELLOW}Step 5: Installing Playwright browsers...${NC}"
ssh -i ${SSH_KEY} ${VM_USER}@${VM_IP} "cd ${SERVICE_DIR} && npx playwright install chromium --with-deps" || {
    echo -e "${YELLOW}⚠️  Playwright installation failed, but continuing...${NC}"
}
echo -e "${GREEN}✅ Playwright browsers installed${NC}"
echo ""

# Step 6: Check for .env file
echo -e "${YELLOW}Step 6: Checking environment configuration...${NC}"
ssh -i ${SSH_KEY} ${VM_USER}@${VM_IP} "test -f ${SERVICE_DIR}/.env" || {
    echo -e "${YELLOW}⚠️  .env file not found. Please create it manually with required environment variables.${NC}"
    echo "   Copy from .env.example and fill in the values."
}
echo ""

# Step 7: Stop existing service if running
echo -e "${YELLOW}Step 7: Stopping existing service (if running)...${NC}"
ssh -i ${SSH_KEY} ${VM_USER}@${VM_IP} "pm2 stop emaf-pdf-service 2>/dev/null || true"
ssh -i ${SSH_KEY} ${VM_USER}@${VM_IP} "pm2 delete emaf-pdf-service 2>/dev/null || true"
echo -e "${GREEN}✅ Old service stopped${NC}"
echo ""

# Step 8: Start service with pm2
echo -e "${YELLOW}Step 8: Starting service with pm2...${NC}"
ssh -i ${SSH_KEY} ${VM_USER}@${VM_IP} "cd ${SERVICE_DIR} && pm2 start ecosystem.config.js"
echo -e "${GREEN}✅ Service started${NC}"
echo ""

# Step 9: Save pm2 configuration
echo -e "${YELLOW}Step 9: Saving pm2 configuration...${NC}"
ssh -i ${SSH_KEY} ${VM_USER}@${VM_IP} "pm2 save"
echo -e "${GREEN}✅ PM2 configuration saved${NC}"
echo ""

# Step 10: Show status
echo -e "${YELLOW}Step 10: Service status...${NC}"
ssh -i ${SSH_KEY} ${VM_USER}@${VM_IP} "pm2 status emaf-pdf-service"
echo ""

echo -e "${GREEN}======================================"
echo "🎉 Deployment Complete!"
echo "======================================${NC}"
echo ""
echo "Your EMAF PDF service is now running on the VM."
echo ""
echo "Next steps:"
echo "1. Configure nginx to proxy /api/pdf/* to localhost:8080"
echo "2. Test health endpoint: curl http://${VM_IP}/api/pdf/health"
echo "3. Check logs: ssh -i ${SSH_KEY} ${VM_USER}@${VM_IP} 'pm2 logs emaf-pdf-service'"
echo ""
