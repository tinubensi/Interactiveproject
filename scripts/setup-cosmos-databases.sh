#!/bin/bash

# Nectaria Cosmos DB Setup Script
# Creates all databases and containers for the security services

set -e

# Configuration
RESOURCE_GROUP="rg-nectaria-dev"
ACCOUNT_NAME="cosmos-nectaria-dev"

echo "=========================================="
echo "Nectaria Cosmos DB Setup"
echo "=========================================="
echo ""

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo "Error: Not logged in to Azure. Run 'az login' first."
    exit 1
fi

echo "Resource Group: $RESOURCE_GROUP"
echo "Account Name: $ACCOUNT_NAME"
echo ""

# Function to create database
create_database() {
    local db_name=$1
    echo "Creating database: $db_name"
    az cosmosdb sql database create \
        --account-name $ACCOUNT_NAME \
        --resource-group $RESOURCE_GROUP \
        --name $db_name \
        --output none 2>/dev/null || echo "  Database $db_name already exists"
}

# Function to create container
create_container() {
    local db_name=$1
    local container_name=$2
    local partition_key=$3
    local ttl=$4  # -1 for no TTL, or seconds

    echo "  Creating container: $container_name (partition: $partition_key, TTL: ${ttl}s)"
    
    local ttl_arg=""
    if [ "$ttl" != "-1" ]; then
        ttl_arg="--ttl $ttl"
    fi

    az cosmosdb sql container create \
        --account-name $ACCOUNT_NAME \
        --resource-group $RESOURCE_GROUP \
        --database-name $db_name \
        --name $container_name \
        --partition-key-path $partition_key \
        $ttl_arg \
        --output none 2>/dev/null || echo "    Container $container_name already exists"
}

# ==========================================
# auth-db Database
# ==========================================
echo ""
echo "Setting up auth-db..."
create_database "auth-db"
create_container "auth-db" "sessions" "/userId" 2592000          # 30 days TTL
create_container "auth-db" "login-attempts" "/email" 900         # 15 minutes TTL

# ==========================================
# authz-db Database
# ==========================================
echo ""
echo "Setting up authz-db..."
create_database "authz-db"
create_container "authz-db" "role-definitions" "/roleId" -1      # No TTL
create_container "authz-db" "user-roles" "/userId" -1            # No TTL
create_container "authz-db" "permission-cache" "/userId" 300     # 5 minutes TTL

# ==========================================
# audit-db Database
# ==========================================
echo ""
echo "Setting up audit-db..."
create_database "audit-db"
create_container "audit-db" "audit-logs" "/entityType" -1        # No TTL (compliance)
create_container "audit-db" "audit-summaries" "/date" 31536000   # 365 days TTL
create_container "audit-db" "exports" "/exportId" 86400          # 24 hours TTL

# ==========================================
# staff-db Database
# ==========================================
echo ""
echo "Setting up staff-db..."
create_database "staff-db"
create_container "staff-db" "staff-members" "/staffId" -1        # No TTL
create_container "staff-db" "teams" "/teamId" -1                 # No TTL
create_container "staff-db" "territories" "/id" -1               # No TTL

# ==========================================
# notification-db Database
# ==========================================
echo ""
echo "Setting up notification-db..."
create_database "notification-db"
create_container "notification-db" "templates" "/templateId" -1   # No TTL
create_container "notification-db" "notifications" "/userId" 7776000  # 90 days TTL
create_container "notification-db" "preferences" "/userId" -1     # No TTL

echo ""
echo "=========================================="
echo "Cosmos DB setup complete!"
echo "=========================================="
echo ""
echo "Databases created:"
echo "  - auth-db (sessions, login-attempts)"
echo "  - authz-db (role-definitions, user-roles, permission-cache)"
echo "  - audit-db (audit-logs, audit-summaries, exports)"
echo "  - staff-db (staff-members, teams, territories)"
echo "  - notification-db (templates, notifications, preferences)"
echo ""

