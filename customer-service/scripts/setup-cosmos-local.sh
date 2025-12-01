#!/bin/bash

# Azure Cosmos DB Emulator Setup Script
# This script sets up Azure Cosmos DB Emulator using Docker for local development

echo "Setting up Azure Cosmos DB Emulator..."

# Determine if we need sudo for docker commands
DOCKER_CMD="docker"
if ! docker info > /dev/null 2>&1; then
    if sudo docker info > /dev/null 2>&1; then
        DOCKER_CMD="sudo docker"
        echo "Note: Using sudo for Docker commands"
    else
        echo "Error: Docker is not running or not accessible. Please:"
        echo "  1. Start Docker Desktop, or"
        echo "  2. Start Docker service: sudo systemctl start docker, or"
        echo "  3. Add your user to docker group: sudo usermod -aG docker $USER (then logout/login)"
        exit 1
    fi
fi

# Check if Docker is running
if ! $DOCKER_CMD info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Stop and remove existing container if it exists
echo "Stopping existing Cosmos DB Emulator container (if any)..."
$DOCKER_CMD stop cosmos-emulator 2>/dev/null || true
$DOCKER_CMD rm cosmos-emulator 2>/dev/null || true

# Start Cosmos DB Emulator
echo "Starting Azure Cosmos DB Emulator..."
$DOCKER_CMD run -d \
    --name cosmos-emulator \
    -p 8081:8081 \
    -p 10250-10255:10250-10255 \
    -m 3g \
    -e AZURE_COSMOS_EMULATOR_PARTITION_COUNT=10 \
    -e AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true \
    mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest

echo "Waiting for Cosmos DB Emulator to start..."
sleep 15

# Check if emulator is running
if $DOCKER_CMD ps | grep -q cosmos-emulator; then
    echo "✓ Azure Cosmos DB Emulator is running!"
    echo ""
    echo "Connection details:"
    echo "  Endpoint: https://localhost:8081"
    echo "  Key: C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw=="
    echo ""
    echo "Update your local.settings.json with:"
    echo "  COSMOS_DB_ENDPOINT: https://localhost:8081"
    echo "  COSMOS_DB_KEY: C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw=="
    echo ""
    echo "To stop the emulator: $DOCKER_CMD stop cosmos-emulator"
    echo "To view logs: $DOCKER_CMD logs cosmos-emulator"
else
    echo "Error: Failed to start Cosmos DB Emulator"
    exit 1
fi

