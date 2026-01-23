#!/bin/bash
# Deploy EMAF Service to Azure VM
# This script deploys the containerized EMAF service to your Azure VM

set -e

# Load environment variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/vm-deployment-config.sh" ]; then
    source "${SCRIPT_DIR}/vm-deployment-config.sh"
else
    echo "⚠️  Warning: vm-deployment-config.sh not found. Using default values."
fi

VM_IP="20.203.51.248"
VM_USER="azureuser"  # Change if different
CONTAINER_NAME="emaf-service"
ACR_NAME="interactivecrmacr"
IMAGE_NAME="emaf-service:latest"

echo "🚀 Deploying EMAF Service to Azure VM"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Testing SSH connection...${NC}"
ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${VM_USER}@${VM_IP} "echo 'SSH connection successful!'" || {
    echo -e "${RED}❌ SSH connection failed!${NC}"
    echo ""
    echo "Please ensure:"
    echo "1. You have SSH access to the VM"
    echo "2. Your SSH key is configured"
    echo "3. VM firewall allows SSH (port 22)"
    echo ""
    echo "To set up SSH access, run:"
    echo "  az vm user update --resource-group Interactive-CRM-Dev --name rpa-vm-production --username ${VM_USER} --ssh-key-value \"\$(cat ~/.ssh/id_rsa.pub)\""
    exit 1
}

echo -e "${GREEN}✅ SSH connection successful${NC}"
echo ""

echo -e "${YELLOW}Step 2: Installing Docker on VM (if not installed)...${NC}"
ssh ${VM_USER}@${VM_IP} "bash -s" << 'ENDSSH'
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y docker.io
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker $USER
    echo "✅ Docker installed"
else
    echo "✅ Docker already installed"
fi
ENDSSH

echo ""
echo -e "${YELLOW}Step 3: Logging into Azure Container Registry...${NC}"
ACR_PASSWORD=$(az acr credential show --name ${ACR_NAME} --query "passwords[0].value" -o tsv)
ssh ${VM_USER}@${VM_IP} "echo '${ACR_PASSWORD}' | sudo docker login ${ACR_NAME}.azurecr.io -u ${ACR_NAME} --password-stdin"
echo -e "${GREEN}✅ Logged into ACR${NC}"
echo ""

echo -e "${YELLOW}Step 4: Stopping old container (if exists)...${NC}"
ssh ${VM_USER}@${VM_IP} "sudo docker stop ${CONTAINER_NAME} 2>/dev/null || true"
ssh ${VM_USER}@${VM_IP} "sudo docker rm ${CONTAINER_NAME} 2>/dev/null || true"
echo -e "${GREEN}✅ Old container removed${NC}"
echo ""

echo -e "${YELLOW}Step 5: Pulling latest Docker image...${NC}"
ssh ${VM_USER}@${VM_IP} "sudo docker pull ${ACR_NAME}.azurecr.io/${IMAGE_NAME}"
echo -e "${GREEN}✅ Image pulled${NC}"
echo ""

echo -e "${YELLOW}Step 6: Starting EMAF service container...${NC}"
ssh ${VM_USER}@${VM_IP} "sudo docker run -d \
  --name ${CONTAINER_NAME} \
  --restart unless-stopped \
  -p 8080:80 \
  -e AzureWebJobsStorage='${AZURE_STORAGE_CONNECTION}' \
  -e COSMOS_CONNECTION_STRING='${COSMOS_CONNECTION_STRING}' \
  -e COSMOS_DATABASE_NAME='${COSMOS_DB_DATABASE}' \
  -e COSMOS_SUBMISSIONS_CONTAINER='${COSMOS_SUBMISSIONS_CONTAINER}' \
  -e COSMOS_TEMPLATES_CONTAINER='${COSMOS_TEMPLATES_CONTAINER}' \
  -e FUNCTIONS_WORKER_RUNTIME=node \
  ${ACR_NAME}.azurecr.io/${IMAGE_NAME}"
echo -e "${GREEN}✅ Container started${NC}"
echo ""

echo -e "${YELLOW}Step 7: Opening firewall port 8080...${NC}"
az vm open-port --resource-group Interactive-CRM-Dev --name rpa-vm-production --port 8080 --priority 1010 2>/dev/null || echo "Port may already be open"
echo -e "${GREEN}✅ Port 8080 opened${NC}"
echo ""

echo -e "${YELLOW}Step 8: Checking container status...${NC}"
sleep 5
ssh ${VM_USER}@${VM_IP} "sudo docker ps --filter name=${CONTAINER_NAME}"
echo ""

echo -e "${GREEN}======================================"
echo "🎉 Deployment Complete!"
echo "======================================${NC}"
echo ""
echo "Your EMAF service is now running at:"
echo -e "${GREEN}http://${VM_IP}:8080${NC}"
echo ""
echo "Test endpoints:"
echo "  • HTML Preview: http://${VM_IP}:8080/api/admin/emaf/preview?vendorCode=alsagr&format=html"
echo "  • PDF Preview:  http://${VM_IP}:8080/api/admin/emaf/preview?vendorCode=alsagr&format=pdf"
echo ""
echo "Useful commands:"
echo "  • View logs:    ssh ${VM_USER}@${VM_IP} 'sudo docker logs -f ${CONTAINER_NAME}'"
echo "  • Restart:      ssh ${VM_USER}@${VM_IP} 'sudo docker restart ${CONTAINER_NAME}'"
echo "  • Stop:         ssh ${VM_USER}@${VM_IP} 'sudo docker stop ${CONTAINER_NAME}'"
echo ""
