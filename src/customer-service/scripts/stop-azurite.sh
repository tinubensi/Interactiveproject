#!/bin/bash
# Stop Azurite (Azure Storage Emulator)

echo "Stopping Azurite..."

if pkill -f azurite; then
    echo "✓ Azurite stopped successfully"
else
    echo "Azurite was not running"
fi

