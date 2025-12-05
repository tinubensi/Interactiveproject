#!/bin/bash

# Script to stop all running services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ports used by services
PORTS=(7071 7072 7073 7074 7076)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Stopping All Services${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to kill process on a port
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null || true)
    
    if [ -z "$pids" ]; then
        echo -e "${YELLOW}Port $port: No process found${NC}"
    else
        echo -e "${RED}Stopping process on port $port (PIDs: $pids)${NC}"
        kill -9 $pids 2>/dev/null || true
        sleep 1
    fi
}

# Kill all processes on service ports
echo -e "${RED}Stopping services on ports...${NC}"
for port in "${PORTS[@]}"; do
    kill_port $port
done

# Kill all func processes
echo ""
echo -e "${RED}Stopping all Azure Functions processes...${NC}"
pkill -f "func start" 2>/dev/null || true
pkill -f "azure-functions-core-tools" 2>/dev/null || true

# Wait for processes to terminate
sleep 2

echo ""
echo -e "${GREEN}All services stopped!${NC}"
echo ""

