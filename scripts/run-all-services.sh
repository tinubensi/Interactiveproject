#!/bin/bash

# =============================================================================
# Nectaria Local Development Services Runner
# =============================================================================
# This script starts all Nectaria services locally on their designated ports.
#
# SERVICE PORT ASSIGNMENTS:
# -------------------------
# Frontend:
#   - intercative-crm-web      : 3000
#
# Backend Services (Azure Functions):
#   - authentication-service   : 7071
#   - authorization-service    : 7072
#   - audit-service            : 7073
#   - staff-management-service : 7074
#   - notification-service     : 7075
#   - workflow-service         : 7076
#   - customer-service         : 7077
#   - lead-service             : 7078
#   - form-service             : 7079
#   - document-service         : 7080
#   - quotation-service        : 7081
#   - quotation-generation-svc : 7082
#   - policy-service           : 7083
#   - pipeline-service         : 7090
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICES_DIR="$SCRIPT_DIR/nectaria-services/src"
FRONTEND_DIR="$SCRIPT_DIR/intercative-crm-web"

# PID file to track started processes
PID_FILE="$SCRIPT_DIR/.nectaria-pids"

# Service definitions: name|directory|port|type(func|next)
declare -a SERVICES=(
    "authentication-service|authentication-service|7071|func"
    "authorization-service|authorization-service|7072|func"
    "audit-service|audit-service|7073|func"
    "staff-management-service|staff-management-service|7074|func"
    "notification-service|notification-service|7075|func"
    "workflow-service|workflow-service|7076|func"
    "customer-service|customer-service|7077|func"
    "lead-service|lead-service|7078|func"
    "form-service|form-service|7079|func"
    "document-service|document-service|7080|func"
    "quotation-service|quotation-service|7081|func"
    "quotation-generation-service|quotation-generation-service|7082|func"
    "policy-service|policy-service|7083|func"
    "pipeline-service|pipeline-service|7090|func"
)

# =============================================================================
# Utility Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}=============================================================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}=============================================================================${NC}"
    echo ""
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        print_error "$1 is not installed. Please install it first."
        return 1
    fi
    return 0
}

check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port in use
    fi
    return 1  # Port available
}

kill_port() {
    local port=$1
    if check_port $port; then
        print_warning "Port $port is in use. Killing process..."
        lsof -ti:$port | xargs -r kill -9 2>/dev/null || true
        sleep 1
    fi
}

# =============================================================================
# Service Management Functions
# =============================================================================

start_frontend() {
    print_header "Starting Frontend (Port 3000)"
    
    if [ ! -d "$FRONTEND_DIR" ]; then
        print_error "Frontend directory not found: $FRONTEND_DIR"
        return 1
    fi
    
    cd "$FRONTEND_DIR"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_status "Installing frontend dependencies..."
        npm install
    fi
    
    # Kill any existing process on port 3000
    kill_port 3000
    
    # Start the frontend
    print_status "Starting Next.js development server..."
    PORT=3000 npm run dev > "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
    echo $! >> "$PID_FILE"
    
    print_success "Frontend started on http://localhost:3000"
}

start_backend_service() {
    local service_name=$1
    local service_dir=$2
    local port=$3
    
    local full_path="$SERVICES_DIR/$service_dir"
    
    if [ ! -d "$full_path" ]; then
        print_warning "Service directory not found: $full_path - Skipping"
        return 0
    fi
    
    cd "$full_path"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies for $service_name..."
        npm install
    fi
    
    # Build TypeScript
    print_status "Building $service_name..."
    npm run build 2>/dev/null || true
    
    # Kill any existing process on the port
    kill_port $port
    
    # Start the Azure Function
    print_status "Starting $service_name on port $port..."
    func start --port $port > "$SCRIPT_DIR/logs/$service_name.log" 2>&1 &
    echo $! >> "$PID_FILE"
    
    print_success "$service_name started on http://localhost:$port"
}

start_all_backend_services() {
    print_header "Starting Backend Services"
    
    for service in "${SERVICES[@]}"; do
        IFS='|' read -r name dir port type <<< "$service"
        start_backend_service "$name" "$dir" "$port"
    done
}

stop_all_services() {
    print_header "Stopping All Services"
    
    # Kill using PID file
    if [ -f "$PID_FILE" ]; then
        while read pid; do
            if kill -0 $pid 2>/dev/null; then
                kill $pid 2>/dev/null || true
                print_status "Stopped process $pid"
            fi
        done < "$PID_FILE"
        rm -f "$PID_FILE"
    fi
    
    # Kill any remaining Azure Functions processes
    pkill -f "func start" 2>/dev/null || true
    
    # Kill Next.js dev server
    pkill -f "next dev" 2>/dev/null || true
    
    # Kill specific ports
    for port in 3000 7071 7072 7073 7074 7075 7076 7077 7078 7079 7080 7081 7082 7083 7090; do
        kill_port $port
    done
    
    print_success "All services stopped"
}

show_status() {
    print_header "Service Status"
    
    echo -e "${CYAN}Frontend:${NC}"
    if check_port 3000; then
        echo -e "  intercative-crm-web      : ${GREEN}RUNNING${NC} (http://localhost:3000)"
    else
        echo -e "  intercative-crm-web      : ${RED}STOPPED${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}Backend Services:${NC}"
    for service in "${SERVICES[@]}"; do
        IFS='|' read -r name dir port type <<< "$service"
        if check_port $port; then
            printf "  %-26s: ${GREEN}RUNNING${NC} (http://localhost:%s)\n" "$name" "$port"
        else
            printf "  %-26s: ${RED}STOPPED${NC}\n" "$name"
        fi
    done
}

show_logs() {
    local service=$1
    local log_file="$SCRIPT_DIR/logs/$service.log"
    
    if [ -f "$log_file" ]; then
        tail -f "$log_file"
    else
        print_error "Log file not found: $log_file"
        echo "Available logs:"
        ls -1 "$SCRIPT_DIR/logs/" 2>/dev/null || echo "  No logs found"
    fi
}

print_usage() {
    echo ""
    echo -e "${CYAN}Nectaria Local Development Services Runner${NC}"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  start         Start all services (frontend + backend)"
    echo "  start-backend Start only backend services"
    echo "  start-frontend Start only frontend"
    echo "  stop          Stop all services"
    echo "  restart       Restart all services"
    echo "  status        Show status of all services"
    echo "  logs <service> Tail logs for a specific service"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start              # Start everything"
    echo "  $0 start-backend      # Start only backend"
    echo "  $0 stop               # Stop everything"
    echo "  $0 status             # Check what's running"
    echo "  $0 logs workflow-service  # View workflow-service logs"
    echo ""
    echo "Service Ports:"
    echo "  Frontend:                3000"
    echo "  authentication-service:  7071"
    echo "  authorization-service:   7072"
    echo "  audit-service:           7073"
    echo "  staff-management-service: 7074"
    echo "  notification-service:    7075"
    echo "  workflow-service:        7076"
    echo "  customer-service:        7077"
    echo "  lead-service:            7078"
    echo "  form-service:            7079"
    echo "  document-service:        7080"
    echo "  quotation-service:       7081"
    echo "  quotation-generation-service: 7082"
    echo "  policy-service:          7083"
    echo "  pipeline-service:        7090"
    echo ""
}

# =============================================================================
# Prerequisites Check
# =============================================================================

check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing=0
    
    if ! check_command "node"; then
        missing=1
    fi
    
    if ! check_command "npm"; then
        missing=1
    fi
    
    if ! check_command "func"; then
        print_warning "Azure Functions Core Tools (func) not found."
        print_warning "Install with: npm install -g azure-functions-core-tools@4 --unsafe-perm true"
        missing=1
    fi
    
    if [ $missing -eq 1 ]; then
        print_error "Prerequisites check failed. Please install missing dependencies."
        exit 1
    fi
    
    print_success "All prerequisites met"
}

# =============================================================================
# Main Script
# =============================================================================

# Create logs directory
mkdir -p "$SCRIPT_DIR/logs"

# Parse command
COMMAND=${1:-help}

case $COMMAND in
    start)
        check_prerequisites
        stop_all_services
        echo "" > "$PID_FILE"
        start_frontend
        start_all_backend_services
        echo ""
        show_status
        echo ""
        print_success "All services started! Logs are in $SCRIPT_DIR/logs/"
        ;;
    
    start-backend)
        check_prerequisites
        echo "" > "$PID_FILE"
        start_all_backend_services
        echo ""
        show_status
        ;;
    
    start-frontend)
        check_prerequisites
        echo "" > "$PID_FILE"
        start_frontend
        echo ""
        show_status
        ;;
    
    stop)
        stop_all_services
        ;;
    
    restart)
        stop_all_services
        sleep 2
        check_prerequisites
        echo "" > "$PID_FILE"
        start_frontend
        start_all_backend_services
        echo ""
        show_status
        ;;
    
    status)
        show_status
        ;;
    
    logs)
        SERVICE=${2:-}
        if [ -z "$SERVICE" ]; then
            print_error "Please specify a service name"
            echo "Available services: frontend, authentication-service, authorization-service, etc."
            exit 1
        fi
        show_logs "$SERVICE"
        ;;
    
    help|--help|-h)
        print_usage
        ;;
    
    *)
        print_error "Unknown command: $COMMAND"
        print_usage
        exit 1
        ;;
esac

