#!/bin/bash

# Script to cleanup all ports and restart all services
# This script kills all running instances and restarts all services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service directories
SERVICES=(
    "src/auth-service"
    "src/customer-service"
    "src/document-service"
    "src/form-service"
    "src/lead-service"
    "src/policy-service"
    "src/quotation-service"
    "src/quotation-generation-service"
    "src/workflow-service"
)

# Ports used by services (for cleanup)
PORTS=(7071 7072 7073 7074 7075 7076 7077 7078 7079)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Service Cleanup and Restart Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to kill process on a port
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null || true)
    
    if [ -z "$pids" ]; then
        echo -e "${YELLOW}Port $port: No process found${NC}"
    else
        echo -e "${YELLOW}Killing process on port $port (PIDs: $pids)${NC}"
        kill -9 $pids 2>/dev/null || true
        sleep 1
    fi
}

# Function to kill all func processes
kill_func_processes() {
    echo -e "${YELLOW}Killing all Azure Functions processes...${NC}"
    pkill -f "func start" 2>/dev/null || true
    pkill -f "npx func start" 2>/dev/null || true
    pkill -f "azure-functions-core-tools" 2>/dev/null || true
    sleep 2
}

# Step 1: Kill all processes on service ports
echo -e "${RED}Step 1: Cleaning up ports...${NC}"
for port in "${PORTS[@]}"; do
    kill_port $port
done

# Step 2: Kill all func processes
echo ""
echo -e "${RED}Step 2: Killing all Azure Functions processes...${NC}"
kill_func_processes

# Wait a bit for processes to fully terminate
sleep 2

echo ""
echo -e "${GREEN}Cleanup complete!${NC}"
echo ""

# Step 3: Start all services
echo -e "${BLUE}Step 3: Starting all services...${NC}"
echo ""

# Get project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# Create logs directory
mkdir -p "$PROJECT_ROOT/logs"

# Array to store background job PIDs
declare -a SERVICE_PIDS=()

# Function to start a service
start_service() {
    local service_dir=$1
    local service_name=$(basename "$service_dir")
    local full_service_path="$PROJECT_ROOT/$service_dir"
    
    if [ ! -d "$full_service_path" ]; then
        echo -e "${RED}Service directory not found: $full_service_path${NC}"
        return 1
    fi
    
    echo -e "${BLUE}Starting $service_name...${NC}"
    cd "$full_service_path"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        echo -e "${YELLOW}Warning: package.json not found in $full_service_path, skipping...${NC}"
        cd "$PROJECT_ROOT"
        return 1
    fi
    
    # Check if node_modules exists, if not install dependencies
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}  Installing dependencies for $service_name...${NC}"
        npm install > "$PROJECT_ROOT/logs/${service_name}-install.log" 2>&1
        if [ $? -ne 0 ]; then
            echo -e "${RED}  Failed to install dependencies for $service_name${NC}"
            cd "$PROJECT_ROOT"
            return 1
        fi
    fi
    
    # Start the service in background
    npm start > "$PROJECT_ROOT/logs/${service_name}.log" 2>&1 &
    local pid=$!
    SERVICE_PIDS+=($pid)
    
    # Wait a moment to check if the process is still running (build might have failed)
    sleep 3
    if ! kill -0 $pid 2>/dev/null; then
        echo -e "${RED}  Failed to start $service_name (process died)${NC}"
        echo -e "${YELLOW}  Check logs/${service_name}.log for details${NC}"
        cd "$PROJECT_ROOT"
        return 1
    fi
    
    echo -e "${GREEN}Started $service_name (PID: $pid)${NC}"
    echo -e "${YELLOW}  Logs: logs/${service_name}.log${NC}"
    
    cd "$PROJECT_ROOT"
    sleep 2  # Give each service time to start
}

# Start all services
for service in "${SERVICES[@]}"; do
    start_service "$service"
done

# Wait a moment for all services to initialize
echo ""
echo -e "${BLUE}Waiting for services to initialize...${NC}"
sleep 5

# Step 4: Check service status
echo ""
echo -e "${BLUE}Step 4: Checking service status...${NC}"
echo ""

for port in "${PORTS[@]}"; do
    if lsof -ti:$port > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Port $port: Service is running${NC}"
    else
        echo -e "${YELLOW}○ Port $port: No service detected${NC}"
    fi
done

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}All services have been restarted!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Service PIDs:${NC}"
for i in "${!SERVICE_PIDS[@]}"; do
    service_name=$(basename "${SERVICES[$i]}")
    echo -e "  ${service_name}: ${SERVICE_PIDS[$i]}"
done
echo ""
echo -e "${YELLOW}To view logs:${NC}"
for service in "${SERVICES[@]}"; do
    local service_name=$(basename "$service")
    echo -e "  tail -f logs/${service_name}.log"
done
echo ""
echo -e "${YELLOW}To stop all services:${NC}"
echo -e "  ./stop-all-services.sh"
echo ""
echo -e "${YELLOW}Or manually kill processes:${NC}"
echo -e "  pkill -f 'func start'"
echo ""

