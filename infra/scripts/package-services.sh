#!/bin/bash
set -e

# Package All Services Script
# This script packages all 13 microservices into deployment-ready zip files

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SRC_DIR="$PROJECT_ROOT/src"
ARTIFACTS_DIR="$PROJECT_ROOT/artifacts"

echo "================================================"
echo "Packaging All Nectaria Services"
echo "================================================"
echo "Project Root: $PROJECT_ROOT"
echo "Artifacts Dir: $ARTIFACTS_DIR"
echo ""

# Create artifacts directory
mkdir -p "$ARTIFACTS_DIR"

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

# Track packaging status
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
  echo "Packaging: $SERVICE"
  echo "----------------------------------------"
  
  cd "$SERVICE_PATH"
  
  # Check if dist directory exists
  if [ ! -d "dist" ]; then
    echo "⚠️  WARNING: dist directory not found. Run build-all-services.sh first."
    FAILED_SERVICES+=("$SERVICE (no dist)")
    continue
  fi
  
  # Create temporary packaging directory
  TEMP_DIR=$(mktemp -d)
  echo "📦 Creating package in: $TEMP_DIR"
  
  # Copy necessary files
  echo "📋 Copying files..."
  cp -r dist/* "$TEMP_DIR/"
  cp package.json "$TEMP_DIR/"
  cp host.json "$TEMP_DIR/" 2>/dev/null || echo "⚠️  No host.json found"
  
  # Install production dependencies (always, regardless of source state)
  echo "📦 Installing production dependencies..."
  cd "$TEMP_DIR"
  if npm install --production --silent; then
    echo "   ✅ Dependencies installed"
  else
    echo "   ❌ Failed to install dependencies"
    FAILED_SERVICES+=("$SERVICE (npm install failed)")
    rm -rf "$TEMP_DIR"
    cd "$SRC_DIR"
    continue
  fi
  cd "$SERVICE_PATH"
  
  # Create zip file
  ZIP_FILE="$ARTIFACTS_DIR/${SERVICE}.zip"
  echo "🗜️  Creating zip: ${SERVICE}.zip"
  
  cd "$TEMP_DIR"
  if zip -r -q "$ZIP_FILE" .; then
    ZIP_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
    echo "✅ Package created: ${SERVICE}.zip ($ZIP_SIZE)"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo "❌ Failed to create zip"
    FAILED_SERVICES+=("$SERVICE (zip failed)")
  fi
  
  # Cleanup
  rm -rf "$TEMP_DIR"
  echo ""
done

echo "================================================"
echo "Packaging Summary"
echo "================================================"
echo "Total Services: ${#SERVICES[@]}"
echo "Successful: $SUCCESS_COUNT"
echo "Failed: ${#FAILED_SERVICES[@]}"
echo "Artifacts Location: $ARTIFACTS_DIR"

if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
  echo ""
  echo "Failed Services:"
  for FAILED in "${FAILED_SERVICES[@]}"; do
    echo "  - $FAILED"
  done
  echo ""
  echo "❌ Packaging completed with errors"
  exit 1
else
  echo ""
  echo "✅ All services packaged successfully!"
  echo ""
  echo "Package Contents:"
  ls -lh "$ARTIFACTS_DIR"/*.zip
fi

