#!/bin/bash

# API Test Script for Quotation Service
# Make sure the service is running on port 7073 before executing

BASE_URL="http://localhost:7073/api"
LEAD_ID="lead-test-001"

echo "========================================="
echo "Quotation Service API Tests"
echo "========================================="
echo ""

# Test 1: Create Quotation
echo "1. Testing Create Quotation..."
QUOT_RESPONSE=$(curl -s -X POST "${BASE_URL}/quotations" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "'${LEAD_ID}'",
    "customerId": "customer-test-001",
    "planIds": ["plan-1", "plan-2"],
    "lineOfBusiness": "medical",
    "businessType": "individual",
    "validityDays": 30
  }')
echo "$QUOT_RESPONSE" | jq
QUOT_ID=$(echo "$QUOT_RESPONSE" | jq -r '.data.quotation.id')
echo "Created Quotation ID: $QUOT_ID"
echo ""

# Test 2: Get Quotation by ID
echo "2. Testing Get Quotation by ID..."
curl -X GET "${BASE_URL}/quotations/${QUOT_ID}?leadId=${LEAD_ID}" | jq
echo ""

# Test 3: List Quotations
echo "3. Testing List Quotations..."
curl -X POST "${BASE_URL}/quotations/list" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "'${LEAD_ID}'",
    "page": 1,
    "limit": 10,
    "sortBy": "createdAt",
    "sortOrder": "desc"
  }' | jq
echo ""

# Test 4: Change Status
echo "4. Testing Change Status..."
curl -X PATCH "${BASE_URL}/quotations/${QUOT_ID}/status?leadId=${LEAD_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "sent",
    "reason": "Sent to customer for review"
  }' | jq
echo ""

# Test 5: Revise Quotation
echo "5. Testing Revise Quotation..."
curl -X POST "${BASE_URL}/quotations/${QUOT_ID}/revise?leadId=${LEAD_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "planIds": ["plan-1", "plan-3"],
    "reason": "Customer requested different plan",
    "remarks": "Replaced plan-2 with plan-3"
  }' | jq
echo ""

echo "========================================="
echo "All tests completed!"
echo "========================================="


