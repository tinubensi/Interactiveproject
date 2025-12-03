#!/bin/bash

# API Test Script for Policy Service
# Make sure the service is running on port 7074 before executing

BASE_URL="http://localhost:7074/api"
QUOTATION_ID="quot-test-001"
LEAD_ID="lead-test-001"
CUSTOMER_ID="customer-test-001"

echo "========================================="
echo "Policy Service API Tests"
echo "========================================="
echo ""

# Test 1: Create Policy Request
echo "1. Testing Create Policy Request..."
POL_REQ_RESPONSE=$(curl -s -X POST "${BASE_URL}/policy-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "quotationId": "'${QUOTATION_ID}'",
    "leadId": "'${LEAD_ID}'",
    "customerId": "'${CUSTOMER_ID}'",
    "selectedPlanId": "plan-1",
    "vendorId": "vendor-adip",
    "vendorName": "Al Dhafra Insurance",
    "lineOfBusiness": "medical",
    "businessType": "individual"
  }')
echo "$POL_REQ_RESPONSE" | jq
POL_REQ_ID=$(echo "$POL_REQ_RESPONSE" | jq -r '.data.policyRequest.id')
echo "Created Policy Request ID: $POL_REQ_ID"
echo ""

# Test 2: List Policy Requests
echo "2. Testing List Policy Requests..."
curl -X POST "${BASE_URL}/policy-requests/list" \
  -H "Content-Type: application/json" \
  -d '{
    "quotationId": "'${QUOTATION_ID}'",
    "page": 1,
    "limit": 10
  }' | jq
echo ""

# Test 3: Approve Policy Request
echo "3. Testing Approve Policy Request..."
curl -X PATCH "${BASE_URL}/policy-requests/${POL_REQ_ID}/status?quotationId=${QUOTATION_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "reviewedBy": "underwriter-001",
    "remarks": "Approved after document verification"
  }' | jq
echo ""

# Test 4: List Policies
echo "4. Testing List Policies..."
curl -X POST "${BASE_URL}/policies/list" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "'${CUSTOMER_ID}'",
    "page": 1,
    "limit": 10
  }' | jq
echo ""

echo "========================================="
echo "All tests completed!"
echo "========================================="


