#!/bin/bash

# Customer Service API Test Script
# This script tests all endpoints of the Customer Service API

BASE_URL="http://localhost:7071/api"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Customer Service API Test Suite"
echo "=========================================="
echo ""

# Check if jq is installed
HAS_JQ=false
if command -v jq &> /dev/null; then
    HAS_JQ=true
else
    echo -e "${YELLOW}Warning: jq is not installed. JSON output will be unformatted.${NC}"
    echo -e "${YELLOW}Install with: sudo apt-get install jq${NC}"
fi

# Helper function to format JSON
format_json() {
    if [ "$HAS_JQ" = true ]; then
        jq '.'
    else
        cat
    fi
}

# Helper function to extract ID from JSON
extract_id() {
    if [ "$HAS_JQ" = true ]; then
        jq -r '.id'
    else
        grep -o '"id":"[^"]*' | cut -d'"' -f4
    fi
}

# Check if Azure Functions is running
echo "Checking if Azure Functions is running..."
if ! curl -s http://localhost:7071 > /dev/null 2>&1; then
    echo -e "${RED}Error: Azure Functions is not running on port 7071${NC}"
    echo "Please start it with: npm start"
    exit 1
fi
echo -e "${GREEN}✓ Azure Functions is running${NC}"
echo ""

# Generate unique email for this test run
TIMESTAMP=$(date +%s)
TEST_EMAIL="test.${TIMESTAMP}@example.com"
echo "Using test email: $TEST_EMAIL"
echo ""

# Test 1: Signup - Individual Customer
echo "=========================================="
echo "Test 1: Signup - Individual Customer"
echo "=========================================="
SIGNUP_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST $BASE_URL/customers/signup \
  -H "Content-Type: application/json" \
  -d "{
    \"customerType\": \"INDIVIDUAL\",
    \"title\": \"Mr\",
    \"firstName\": \"John\",
    \"lastName\": \"Doe\",
    \"name\": \"John Doe\",
    \"dateOfBirth\": \"1990-01-15\",
    \"email\": \"$TEST_EMAIL\",
    \"phoneNumber\": \"+971501234567\",
    \"mobileNumber\": \"+971501234567\",
    \"nationality\": \"American\",
    \"gender\": \"Male\",
    \"address\": \"123 Main St, Dubai\",
    \"agent\": \"Direct\",
    \"placementExecutive\": \"Jane Smith\",
    \"customerTypeCategory\": \"VERY IMPORTANT PERSON\",
    \"currency\": \"AED\"
  }")

HTTP_CODE=$(echo "$SIGNUP_RESPONSE" | tail -n1)
BODY=$(echo "$SIGNUP_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "${GREEN}✓ Signup successful (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | format_json
    CUSTOMER_ID=$(echo "$BODY" | extract_id)
    echo ""
    echo -e "${GREEN}Customer ID: $CUSTOMER_ID${NC}"
else
    echo -e "${RED}✗ Signup failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | format_json
    echo ""
    echo -e "${YELLOW}Note: If you see 'self-signed certificate' error, Cosmos DB emulator needs SSL verification disabled${NC}"
    exit 1
fi
echo ""

# Test 2: Signup - Company Customer
COMPANY_EMAIL="company.${TIMESTAMP}@example.com"
echo "=========================================="
echo "Test 2: Signup - Company Customer"
echo "=========================================="
COMPANY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST $BASE_URL/customers/signup \
  -H "Content-Type: application/json" \
  -d "{
    \"customerType\": \"COMPANY\",
    \"title\": \"M/S\",
    \"companyName\": \"Acme Corporation\",
    \"tradeLicenseId\": \"TL${TIMESTAMP}\",
    \"email1\": \"$COMPANY_EMAIL\",
    \"phoneNumber1\": \"+97141234567\",
    \"phoneNumber2\": \"+97141234568\",
    \"address\": \"Business Bay, Dubai\",
    \"agent\": \"Direct\",
    \"accountExecutive\": \"John Manager\",
    \"customerTypeCategory\": \"VERY IMPORTANT PERSON\",
    \"currency\": \"AED\",
    \"creditLimit\": 100000,
    \"creditTerm\": 30,
    \"monthlyIncome\": 50000,
    \"trnNumber\": \"TRN${TIMESTAMP}\"
  }")

HTTP_CODE=$(echo "$COMPANY_RESPONSE" | tail -n1)
BODY=$(echo "$COMPANY_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "${GREEN}✓ Company signup successful (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | format_json
    COMPANY_ID=$(echo "$BODY" | extract_id)
    echo ""
    echo -e "${GREEN}Company ID: $COMPANY_ID${NC}"
else
    echo -e "${RED}✗ Company signup failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | format_json
fi
echo ""

# Test 3: Login (Request OTP)
echo "=========================================="
echo "Test 3: Login (Request OTP)"
echo "=========================================="
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST $BASE_URL/customers/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_EMAIL\"}")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Login request successful (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | format_json
    if [ "$HAS_JQ" = true ]; then
        OTP=$(echo "$BODY" | jq -r '.otp // empty')
    else
        OTP=$(echo "$BODY" | grep -o '"otp":"[^"]*' | cut -d'"' -f4)
    fi
    if [ -n "$OTP" ] && [ "$OTP" != "null" ] && [ "$OTP" != "" ]; then
        echo ""
        echo -e "${GREEN}OTP: $OTP${NC}"
        TEST_OTP=$OTP
    else
        echo ""
        echo -e "${YELLOW}Note: Check Azure Functions console logs for OTP${NC}"
        echo -e "${YELLOW}OTP will be logged in the format: 'OTP for email: XXXXXX'${NC}"
        TEST_OTP=""
    fi
else
    echo -e "${RED}✗ Login request failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | format_json
fi
echo ""

# Test 4: Get Customer by ID
if [ -n "$CUSTOMER_ID" ]; then
    echo "=========================================="
    echo "Test 4: Get Customer by ID"
    echo "=========================================="
    GET_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET $BASE_URL/customers/$CUSTOMER_ID \
      -H "Content-Type: application/json")

    HTTP_CODE=$(echo "$GET_RESPONSE" | tail -n1)
    BODY=$(echo "$GET_RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" -eq 200 ]; then
        echo -e "${GREEN}✓ Get customer successful (HTTP $HTTP_CODE)${NC}"
        echo "$BODY" | format_json
    else
        echo -e "${RED}✗ Get customer failed (HTTP $HTTP_CODE)${NC}"
        echo "$BODY" | format_json
    fi
    echo ""
fi

# Test 5: Update Profile
if [ -n "$CUSTOMER_ID" ]; then
    echo "=========================================="
    echo "Test 5: Update Customer Profile"
    echo "=========================================="
    UPDATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT $BASE_URL/customers/$CUSTOMER_ID/profile \
      -H "Content-Type: application/json" \
      -d '{
        "firstName": "Jane",
        "lastName": "Smith"
      }')

    HTTP_CODE=$(echo "$UPDATE_RESPONSE" | tail -n1)
    BODY=$(echo "$UPDATE_RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" -eq 200 ]; then
        echo -e "${GREEN}✓ Update profile successful (HTTP $HTTP_CODE)${NC}"
        echo "$BODY" | format_json
    else
        echo -e "${RED}✗ Update profile failed (HTTP $HTTP_CODE)${NC}"
        echo "$BODY" | format_json
    fi
    echo ""
fi

# Test 6: Add Contact
if [ -n "$CUSTOMER_ID" ]; then
    echo "=========================================="
    echo "Test 6: Add Contact"
    echo "=========================================="
    CONTACT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST $BASE_URL/customers/$CUSTOMER_ID/contact \
      -H "Content-Type: application/json" \
      -d '{
        "type": "email",
        "value": "newemail@example.com"
      }')

    HTTP_CODE=$(echo "$CONTACT_RESPONSE" | tail -n1)
    BODY=$(echo "$CONTACT_RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" -eq 200 ]; then
        echo -e "${GREEN}✓ Add contact successful (HTTP $HTTP_CODE)${NC}"
        echo "$BODY" | format_json
    else
        echo -e "${RED}✗ Add contact failed (HTTP $HTTP_CODE)${NC}"
        echo "$BODY" | format_json
    fi
    echo ""
fi

# Test 7: Get Policies
if [ -n "$CUSTOMER_ID" ]; then
    echo "=========================================="
    echo "Test 7: Get Customer Policies"
    echo "=========================================="
    POLICIES_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET $BASE_URL/customers/$CUSTOMER_ID/policies \
      -H "Content-Type: application/json")

    HTTP_CODE=$(echo "$POLICIES_RESPONSE" | tail -n1)
    BODY=$(echo "$POLICIES_RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" -eq 200 ]; then
        echo -e "${GREEN}✓ Get policies successful (HTTP $HTTP_CODE)${NC}"
        echo "$BODY" | format_json
    else
        echo -e "${RED}✗ Get policies failed (HTTP $HTTP_CODE)${NC}"
        echo "$BODY" | format_json
    fi
    echo ""
fi

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
if [ -n "$CUSTOMER_ID" ]; then
    echo -e "${GREEN}✓ Individual Customer Signup${NC}"
    echo "  Customer ID: $CUSTOMER_ID"
fi
if [ -n "$COMPANY_ID" ]; then
    echo -e "${GREEN}✓ Company Customer Signup${NC}"
    echo "  Company ID: $COMPANY_ID"
fi
echo -e "${GREEN}✓ Login (OTP Request)${NC}"
if [ -n "$CUSTOMER_ID" ]; then
    echo -e "${GREEN}✓ Get Customer${NC}"
    echo -e "${GREEN}✓ Update Profile${NC}"
    echo -e "${GREEN}✓ Add Contact${NC}"
    echo -e "${GREEN}✓ Get Policies${NC}"
fi
echo ""
echo "To view data in Cosmos DB:"
echo "  https://localhost:8081/_explorer/index.html"
echo ""
echo "=========================================="
