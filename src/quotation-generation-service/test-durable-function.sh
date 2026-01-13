#!/bin/bash

# Test script for Durable Functions implementation
# This tests the complete flow without requiring RPA to complete

set -e

echo "=========================================="
echo "🧪 Durable Functions Test Script"
echo "=========================================="
echo ""

# Configuration
SERVICE_URL="http://localhost:7072"
TEST_LEAD_ID="test-lead-durable-$(date +%s)"

echo "Test Lead ID: $TEST_LEAD_ID"
echo "Service URL: $SERVICE_URL"
echo ""

# Step 1: Start plan fetching
echo "Step 1: Starting plan fetching orchestration..."
RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/plans/fetch-durable" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "'"$TEST_LEAD_ID"'",
    "lineOfBusiness": "medical",
    "businessType": "individual",
    "leadData": {
      "dateOfBirth": "1990-01-15",
      "gender": "Male",
      "nationality": "United Arab Emirates"
    }
  }')

echo "$RESPONSE" | jq .

# Extract orchestration ID
ORCHESTRATION_ID=$(echo "$RESPONSE" | jq -r '.orchestrationId')

if [ "$ORCHESTRATION_ID" == "null" ] || [ -z "$ORCHESTRATION_ID" ]; then
    echo ""
    echo "❌ Failed to start orchestration!"
    exit 1
fi

echo ""
echo "✅ Orchestration started: $ORCHESTRATION_ID"
echo ""

# Step 2: Query status
sleep 2
echo "Step 2: Querying orchestration status..."
STATUS_RESPONSE=$(curl -s -X GET "$SERVICE_URL/api/orchestrations/status/$ORCHESTRATION_ID")
echo "$STATUS_RESPONSE" | jq .

RUNTIME_STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.runtimeStatus')
echo ""
echo "Current status: $RUNTIME_STATUS"
echo ""

# Step 3: Simulate RPA completion
echo "Step 3: Simulating RPA completion event..."
sleep 1

EVENT_RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/orchestrations/$ORCHESTRATION_ID/raiseEvent/RPA_COMPLETED" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "'"$TEST_LEAD_ID"'",
    "vendorId": "watania",
    "planCount": 3,
    "success": true,
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }')

echo "$EVENT_RESPONSE" | jq .
echo ""

# Step 4: Wait for orchestration to complete
echo "Step 4: Waiting for orchestration to complete..."
for i in {1..10}; do
    sleep 2
    STATUS=$(curl -s -X GET "$SERVICE_URL/api/orchestrations/status/$ORCHESTRATION_ID" | jq -r '.runtimeStatus')
    echo "   Check $i: Status = $STATUS"
    
    if [ "$STATUS" == "Completed" ]; then
        echo ""
        echo "✅ Orchestration completed successfully!"
        break
    fi
    
    if [ "$STATUS" == "Failed" ]; then
        echo ""
        echo "❌ Orchestration failed!"
        curl -s -X GET "$SERVICE_URL/api/orchestrations/status/$ORCHESTRATION_ID" | jq .
        exit 1
    fi
done

echo ""

# Step 5: Get final status
echo "Step 5: Getting final orchestration result..."
FINAL_RESPONSE=$(curl -s -X GET "$SERVICE_URL/api/orchestrations/status/$ORCHESTRATION_ID")
echo "$FINAL_RESPONSE" | jq .

echo ""
echo "=========================================="
echo "✅ Durable Functions Test Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  Orchestration ID: $ORCHESTRATION_ID"
echo "  Lead ID: $TEST_LEAD_ID"
echo "  Final Status: $(echo "$FINAL_RESPONSE" | jq -r '.runtimeStatus')"
echo ""
echo "Next steps:"
echo "  1. Check Event Grid events were published"
echo "  2. Verify Pipeline Service received events"
echo "  3. Test with real RPA containers"











