#!/bin/bash

###############################################################################
# Event Grid Subscription Setup for Enhanced Pipeline
# Creates Event Grid subscriptions for pipeline action events and completions
###############################################################################

set -e # Exit on error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Enhanced Pipeline Event Grid Setup${NC}"
echo -e "${GREEN}=========================================${NC}\n"

# Configuration
RESOURCE_GROUP="nectaria-rg-dev"
TOPIC_NAME="nectaria-eventgrid-topic-dev"
REGION="uaenorth"
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Service endpoints
PIPELINE_SERVICE="https://func-nectaria-pipeline-dev.azurewebsites.net"
QUOTATION_GEN_SERVICE="https://func-nectaria-quotation-gen-dev.azurewebsites.net"
QUOTATION_SERVICE="https://func-nectaria-quotation-dev.azurewebsites.net"
POLICY_SERVICE="https://func-nectaria-policy-dev.azurewebsites.net"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Topic Name: $TOPIC_NAME"
echo "  Region: $REGION"
echo "  Subscription ID: $SUBSCRIPTION_ID"
echo ""

# Check if Azure CLI is logged in
if ! az account show &>/dev/null; then
    echo -e "${RED}✗ Azure CLI not logged in. Please run 'az login' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Azure CLI authenticated${NC}\n"

# Function to create subscription with retry
create_subscription() {
    local name=$1
    local event_type=$2
    local endpoint=$3
    local function_name=$4
    
    echo -e "${YELLOW}Creating subscription: $name${NC}"
    echo "  Event Type: $event_type"
    echo "  Function: $function_name"
    
    # Delete existing subscription if it exists
    if az eventgrid event-subscription show \
        --name "$name" \
        --source-resource-id "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.EventGrid/topics/$TOPIC_NAME" \
        &>/dev/null; then
        echo "  (Deleting existing subscription...)"
        az eventgrid event-subscription delete \
            --name "$name" \
            --source-resource-id "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.EventGrid/topics/$TOPIC_NAME" \
            &>/dev/null || true
        sleep 2
    fi
    
    # Create subscription
    az eventgrid event-subscription create \
        --name "$name" \
        --source-resource-id "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.EventGrid/topics/$TOPIC_NAME" \
        --endpoint "$endpoint/runtime/webhooks/EventGrid?functionName=$function_name" \
        --endpoint-type webhook \
        --included-event-types "$event_type" \
        --advanced-filter data.instanceId StringContains "" \
        --max-delivery-attempts 10 \
        --event-delivery-schema eventgridschema \
        &>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ Subscription created successfully${NC}\n"
        return 0
    else
        echo -e "${RED}  ✗ Failed to create subscription${NC}\n"
        return 1
    fi
}

# Function to create multi-event subscription
create_multi_event_subscription() {
    local name=$1
    local endpoint=$2
    local function_name=$3
    shift 3
    local event_types=("$@")
    
    echo -e "${YELLOW}Creating multi-event subscription: $name${NC}"
    echo "  Event Types: ${event_types[*]}"
    echo "  Function: $function_name"
    
    # Delete existing subscription if it exists
    if az eventgrid event-subscription show \
        --name "$name" \
        --source-resource-id "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.EventGrid/topics/$TOPIC_NAME" \
        &>/dev/null; then
        echo "  (Deleting existing subscription...)"
        az eventgrid event-subscription delete \
            --name "$name" \
            --source-resource-id "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.EventGrid/topics/$TOPIC_NAME" \
            &>/dev/null || true
        sleep 2
    fi
    
    # Build included-event-types parameter
    local event_types_param=""
    for event in "${event_types[@]}"; do
        event_types_param="$event_types_param $event"
    done
    
    # Create subscription
    az eventgrid event-subscription create \
        --name "$name" \
        --source-resource-id "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.EventGrid/topics/$TOPIC_NAME" \
        --endpoint "$endpoint/runtime/webhooks/EventGrid?functionName=$function_name" \
        --endpoint-type webhook \
        --included-event-types $event_types_param \
        --advanced-filter data.instanceId StringContains "" \
        --max-delivery-attempts 10 \
        --event-delivery-schema eventgridschema \
        &>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ Subscription created successfully${NC}\n"
        return 0
    else
        echo -e "${RED}  ✗ Failed to create subscription${NC}\n"
        return 1
    fi
}

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Creating Action Event Subscriptions${NC}"
echo -e "${GREEN}=========================================${NC}\n"

# 1. Action: fetch_plans → Quotation Gen Service
create_subscription \
    "action-fetch-plans" \
    "pipeline.action.fetch_plans" \
    "$QUOTATION_GEN_SERVICE" \
    "HandleFetchPlansAction"

# 2. Action: send_quotation → Quotation Service
create_subscription \
    "action-send-quotation" \
    "pipeline.action.send_quotation" \
    "$QUOTATION_SERVICE" \
    "HandleSendQuotationAction"

# 3. Action: issue_policy → Policy Service
create_subscription \
    "action-issue-policy" \
    "pipeline.action.issue_policy" \
    "$POLICY_SERVICE" \
    "HandleIssuePolicyAction"

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Creating Completion Event Subscriptions${NC}"
echo -e "${GREEN}=========================================${NC}\n"

# 4. Completion events → Pipeline Service
create_multi_event_subscription \
    "service-completions-to-pipeline" \
    "$PIPELINE_SERVICE" \
    "PipelineOrchestrator" \
    "service.fetch_plans.completed" \
    "service.fetch_plans.failed" \
    "service.send_quotation.completed" \
    "service.send_quotation.failed" \
    "service.issue_policy.completed" \
    "service.issue_policy.failed"

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✓ Event Grid Setup Complete!${NC}"
echo -e "${GREEN}=========================================${NC}\n"

echo -e "${YELLOW}Created Subscriptions:${NC}"
echo "  1. action-fetch-plans"
echo "  2. action-send-quotation"
echo "  3. action-issue-policy"
echo "  4. service-completions-to-pipeline"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Verify subscriptions in Azure Portal"
echo "  2. Test with a new lead creation"
echo "  3. Monitor Event Grid metrics"
echo ""

echo -e "${GREEN}Script completed successfully!${NC}\n"

