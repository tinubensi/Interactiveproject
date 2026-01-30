#!/bin/bash

# Docker Build Script for EMAF Service
# This script builds and optionally pushes the Docker image to Azure Container Registry

set -e

# Configuration
IMAGE_NAME="emaf-service"
VERSION="${1:-latest}"
ACR_NAME="${ACR_NAME:-interactivecrmacr}"
REGISTRY="${ACR_NAME}.azurecr.io"
FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}:${VERSION}"

echo "========================================="
echo "Building EMAF Service Docker Image"
echo "========================================="
echo "Image: ${FULL_IMAGE_NAME}"
echo "========================================="
echo ""

# Navigate to the service directory
cd "$(dirname "$0")"

# Build the Docker image
echo "📦 Building Docker image..."
docker build \
  --platform linux/amd64 \
  -t ${IMAGE_NAME}:${VERSION} \
  -t ${IMAGE_NAME}:latest \
  -t ${FULL_IMAGE_NAME} \
  --progress=plain \
  .

echo ""
echo "✅ Docker image built successfully!"
echo ""
echo "Image tags:"
echo "  - ${IMAGE_NAME}:${VERSION}"
echo "  - ${IMAGE_NAME}:latest"
echo "  - ${FULL_IMAGE_NAME}"
echo ""

# Test the image locally (optional)
read -p "Do you want to test the image locally? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧪 Testing image locally..."
    docker run --rm -p 7078:80 -e "AzureWebJobsStorage=UseDevelopmentStorage=true" ${IMAGE_NAME}:${VERSION} &
    DOCKER_PID=$!
    
    echo "Container started. Waiting 10 seconds for startup..."
    sleep 10
    
    echo "Testing health endpoint..."
    curl -f http://localhost:7078/api/health || echo "Health check failed"
    
    echo "Stopping test container..."
    kill $DOCKER_PID || true
    
    echo "✅ Local test complete"
    echo ""
fi

# Push to Azure Container Registry
read -p "Do you want to push to Azure Container Registry? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📤 Logging in to Azure Container Registry..."
    az acr login --name ${ACR_NAME}
    
    echo "📤 Pushing image to ACR..."
    docker push ${FULL_IMAGE_NAME}
    
    echo "✅ Image pushed successfully to ACR!"
    echo ""
    echo "To deploy to Azure Functions:"
    echo "  az functionapp config container set \\"
    echo "    --name <function-app-name> \\"
    echo "    --resource-group <resource-group> \\"
    echo "    --docker-custom-image-name ${FULL_IMAGE_NAME}"
fi

echo ""
echo "========================================="
echo "Build Complete!"
echo "========================================="
