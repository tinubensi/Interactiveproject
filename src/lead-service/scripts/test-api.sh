#!/bin/bash

# Test API Script for Lead Service
# Run this after starting the service with `npm start`

BASE_URL="http://localhost:7071/api"

echo "================================"
echo "Lead Service API Test"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Get Stages
echo -e "\n${GREEN}Test 1: Get Stages${NC}"
curl -X GET "$BASE_URL/stages" | jq .

# Test 2: Get Pet Types
echo -e "\n${GREEN}Test 2: Get Pet Types${NC}"
curl -X GET "$BASE_URL/metadata/pet-types" | jq .

# Test 3: Get Emirates
echo -e "\n${GREEN}Test 3: Get Emirates${NC}"
curl -X GET "$BASE_URL/metadata/emirates" | jq .

# Test 4: Get Breeds for Dog
echo -e "\n${GREEN}Test 4: Get Breeds for Dog${NC}"
curl -X POST "$BASE_URL/metadata/breeds" \
  -H "Content-Type: application/json" \
  -d '{"petTypeId": "pet-type-1"}' | jq .

# Test 5: Create Medical Lead (Individual)
echo -e "\n${GREEN}Test 5: Create Medical Lead (Individual)${NC}"
LEAD_RESPONSE=$(curl -X POST "$BASE_URL/leads" \
  -H "Content-Type: application/json" \
  -d '{
    "lineOfBusiness": "medical",
    "businessType": "individual",
    "customerId": "customer-123",
    "firstName": "Ahmed",
    "lastName": "Ali",
    "email": "ahmed.ali@example.com",
    "phone": {
      "number": "+971501234567",
      "countryCode": "+971",
      "isoCode": "AE"
    },
    "emirate": "Dubai",
    "lobData": {
      "petName": "Max",
      "petType": "dog",
      "petGender": "male",
      "petBirthday": "2020-05-15",
      "petBreed": "Golden Retriever",
      "breedType": "Large",
      "isPureBreed": true,
      "isMicrochipped": true,
      "microchipId": "123456789",
      "isNeutered": true,
      "hasHealthIssues": false,
      "weightInKg": 30
    },
    "source": "Website"
  }')

echo $LEAD_RESPONSE | jq .

# Extract lead ID and lineOfBusiness for next tests
LEAD_ID=$(echo $LEAD_RESPONSE | jq -r '.data.lead.id')
LOB="medical"

# Test 6: Get Lead by ID
echo -e "\n${GREEN}Test 6: Get Lead by ID${NC}"
curl -X GET "$BASE_URL/leads/$LEAD_ID?lineOfBusiness=$LOB" | jq .

# Test 7: List Leads
echo -e "\n${GREEN}Test 7: List Leads${NC}"
curl -X POST "$BASE_URL/leads/list" \
  -H "Content-Type: application/json" \
  -d '{
    "page": 1,
    "limit": 10,
    "sortBy": "createdAt",
    "sortOrder": "desc"
  }' | jq .

# Test 8: Update Lead
echo -e "\n${GREEN}Test 8: Update Lead${NC}"
curl -X PUT "$BASE_URL/leads/$LEAD_ID?lineOfBusiness=$LOB" \
  -H "Content-Type: application/json" \
  -d '{
    "isHotLead": true
  }' | jq .

# Test 9: Get Timeline
echo -e "\n${GREEN}Test 9: Get Timeline${NC}"
curl -X GET "$BASE_URL/leads/$LEAD_ID/timeline" | jq .

# Test 10: Change Stage
echo -e "\n${GREEN}Test 10: Change Stage${NC}"
curl -X PATCH "$BASE_URL/leads/$LEAD_ID/stage?lineOfBusiness=$LOB" \
  -H "Content-Type: application/json" \
  -d '{
    "stageId": 2,
    "remark": "Plans are ready for review"
  }' | jq .

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}All tests completed!${NC}"
echo -e "${GREEN}================================${NC}"


