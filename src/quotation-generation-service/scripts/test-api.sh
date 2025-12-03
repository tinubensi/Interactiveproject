#!/bin/bash

# API Test Script for Quotation Generation Service
# Make sure the service is running on port 7072 before executing

BASE_URL="http://localhost:7072/api"
LEAD_ID="lead-test-001"

echo "========================================="
echo "Quotation Generation Service API Tests"
echo "========================================="
echo ""

# Test 1: Fetch Plans
echo "1. Testing Fetch Plans..."
curl -X POST "${BASE_URL}/plans/fetch" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "'${LEAD_ID}'",
    "lineOfBusiness": "medical",
    "businessType": "individual",
    "leadData": {
      "petType": "Dog",
      "petBreed": "Golden Retriever",
      "petBirthday": "2020-01-15"
    }
  }' | jq
echo ""

# Test 2: List Plans
echo "2. Testing List Plans..."
curl -X POST "${BASE_URL}/plans/list" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "'${LEAD_ID}'",
    "page": 1,
    "limit": 10,
    "sortBy": "annualPremium",
    "sortOrder": "asc"
  }' | jq
echo ""

# Test 3: Save Filters
echo "3. Testing Save Filters..."
curl -X POST "${BASE_URL}/plans/filters" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "'${LEAD_ID}'",
    "annualPremium": {
      "min": 1000,
      "max": 3000
    },
    "deductible": {
      "max": 500
    }
  }' | jq
echo ""

# Test 4: Get Filters
echo "4. Testing Get Filters..."
curl -X GET "${BASE_URL}/plans/filters/${LEAD_ID}" | jq
echo ""

# Test 5: Create Comparison
echo "5. Testing Create Comparison..."
PLAN_ID_1="plan-${LEAD_ID}-1"
PLAN_ID_2="plan-${LEAD_ID}-2"
curl -X POST "${BASE_URL}/plans/compare" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "'${LEAD_ID}'",
    "planIds": ["'${PLAN_ID_1}'", "'${PLAN_ID_2}'"]
  }' | jq
echo ""

# Test 6: Get Comparison
echo "6. Testing Get Comparison..."
curl -X GET "${BASE_URL}/plans/compare?leadId=${LEAD_ID}" | jq
echo ""

# Test 7: Select Plans
echo "7. Testing Select Plans..."
curl -X POST "${BASE_URL}/plans/select" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "'${LEAD_ID}'",
    "planIds": ["'${PLAN_ID_1}'"]
  }' | jq
echo ""

# Test 8: Get Vendors
echo "8. Testing Get Vendors..."
curl -X GET "${BASE_URL}/vendors?lineOfBusiness=medical" | jq
echo ""

echo "========================================="
echo "All tests completed!"
echo "========================================="


