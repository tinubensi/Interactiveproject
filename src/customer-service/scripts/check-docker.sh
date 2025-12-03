#!/bin/bash
# Check Docker status and provide setup instructions

echo "Checking Docker setup..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    echo "Install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✓ Docker is installed"

# Check if user can access Docker
if docker info > /dev/null 2>&1; then
    echo "✓ Docker is accessible (no sudo needed)"
    echo ""
    echo "You can run: ./scripts/setup-cosmos-local.sh"
    exit 0
fi

# Check if Docker service is running
if sudo docker info > /dev/null 2>&1; then
    echo "⚠ Docker requires sudo access"
    echo ""
    echo "To fix this permanently, run:"
    echo "  sudo usermod -aG docker $USER"
    echo "  (Then logout and login again)"
    echo ""
    echo "For now, you can run the setup script with sudo:"
    echo "  sudo ./scripts/setup-cosmos-local.sh"
    exit 0
fi

# Docker service might not be running
echo "❌ Docker service is not running"
echo ""
echo "Try one of these:"
echo "  1. Start Docker Desktop (if installed)"
echo "  2. Start Docker service: sudo systemctl start docker"
echo "  3. Check Docker status: sudo systemctl status docker"

