#!/bin/bash
set -e

# Build All Services Script
# This script builds all 13 microservices in the nectaria-services project

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SRC_DIR="$PROJECT_ROOT/src"

echo "================================================"
echo "Building All Nectaria Services"
echo "================================================"
echo "Project Root: $PROJECT_ROOT"
echo ""

# Define all services
SERVICES=(
  "authentication-service"
  "authorization-service"
  "audit-service"
  "staff-management-service"
  "notification-service"
  "customer-service"
  "form-service"
  "lead-service"
  "quotation-service"
  "quotation-generation-service"
  "policy-service"
  "document-service"
  "pipeline-service"
)

# Track build status
FAILED_SERVICES=()
SUCCESS_COUNT=0

for SERVICE in "${SERVICES[@]}"; do
  SERVICE_PATH="$SRC_DIR/$SERVICE"
  
  if [ ! -d "$SERVICE_PATH" ]; then
    echo "⚠️  WARNING: Service directory not found: $SERVICE_PATH"
    FAILED_SERVICES+=("$SERVICE (not found)")
    continue
  fi
  
  echo "----------------------------------------"
  echo "Building: $SERVICE"
  echo "----------------------------------------"
  
  cd "$SERVICE_PATH"
  
  # Check if package.json exists
  if [ ! -f "package.json" ]; then
    echo "⚠️  WARNING: No package.json found in $SERVICE"
    FAILED_SERVICES+=("$SERVICE (no package.json)")
    continue
  fi
  
  # Install dependencies
  echo "📦 Installing dependencies..."
  if npm install --silent; then
    echo "✅ Dependencies installed"
  else
    echo "❌ Failed to install dependencies"
    FAILED_SERVICES+=("$SERVICE (npm install failed)")
    continue
  fi
  
  # Build TypeScript
  echo "🔨 Building TypeScript..."
  if npm run build; then
    echo "✅ Build successful"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo "❌ Build failed"
    FAILED_SERVICES+=("$SERVICE (build failed)")
    continue
  fi
  
  echo ""
done

echo "================================================"
echo "Build Summary"
echo "================================================"
echo "Total Services: ${#SERVICES[@]}"
echo "Successful: $SUCCESS_COUNT"
echo "Failed: ${#FAILED_SERVICES[@]}"

if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
  echo ""
  echo "Failed Services:"
  for FAILED in "${FAILED_SERVICES[@]}"; do
    echo "  - $FAILED"
  done
  echo ""
  echo "❌ Build completed with errors"
  exit 1
else
  echo ""
  echo "✅ All services built successfully!"
fi

