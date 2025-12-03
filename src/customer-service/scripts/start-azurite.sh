#!/bin/bash
# Start Azurite (Azure Storage Emulator) for local Azure Functions development

echo "Starting Azurite (Azure Storage Emulator)..."

# Check if Azurite is installed
if ! command -v azurite &> /dev/null; then
    echo "Azurite not found. Installing globally..."
    npm install -g azurite
fi

# Create directory for Azurite data if it doesn't exist
mkdir -p ~/azurite

# Check if Azurite is already running
if lsof -Pi :10000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "Azurite is already running on port 10000"
    echo "To stop it, run: pkill -f azurite"
    exit 0
fi

# Start Azurite in the background
echo "Starting Azurite on ports 10000, 10001, 10002..."
azurite --silent --location ~/azurite --debug ~/azurite/debug.log &

# Wait a moment for Azurite to start
sleep 2

# Check if it started successfully
if lsof -Pi :10000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "✓ Azurite started successfully!"
    echo ""
    echo "Azurite is running on:"
    echo "  Blob Service: http://127.0.0.1:10000"
    echo "  Queue Service: http://127.0.0.1:10001"
    echo "  Table Service: http://127.0.0.1:10002"
    echo ""
    echo "Data location: ~/azurite"
    echo "Debug logs: ~/azurite/debug.log"
    echo ""
    echo "To stop Azurite, run: pkill -f azurite"
else
    echo "Error: Failed to start Azurite"
    exit 1
fi

