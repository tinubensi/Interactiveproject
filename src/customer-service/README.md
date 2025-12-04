# Customer Service - Microservice Documentation

## 📋 Overview

The **Customer Service** is a serverless microservice built on Azure Functions that manages customer data, authentication, and user operations. It follows a microservices architecture pattern with Azure Cosmos DB as the data store and Event Grid for event-driven communication.

---

## 🏗️ Architecture

### Technology Stack
- **Runtime:** Node.js 20 (LTS)
- **Framework:** Azure Functions v4
- **Database:** Azure Cosmos DB (SQL API)
- **Event Bus:** Azure Event Grid
- **Email Service:** Nodemailer + Mailtrap (SMTP)
- **Language:** TypeScript

### Design Patterns
- **Serverless Architecture:** Pay-per-execution model
- **Microservices:** Independent, loosely-coupled service
- **Event-Driven:** Publishes domain events for other services
- **Database per Service:** Dedicated Cosmos DB database

---

## 📊 Data Models

### Customer (Individual)
```typescript
{
  id: string;                    // Unique customer ID
  email: string;                 // Primary email (unique)
  customerType: "INDIVIDUAL";    // Customer type discriminator
  firstName: string;
  lastName: string;
  phoneNumber: string;
  address?: string;
  dateOfBirth?: string;         // ISO-8601 date
  emiratesId?: string;
  passportNumber?: string;
  nationality?: string;
  agentType: "Direct" | "Agent";
  accountExecutive?: string;
  customerTypeCategory?: string;
  currency: "AED" | "USD" | "EUR";
  creditLimit?: number;
  creditTerm?: number;
  monthlyIncome?: number;
  createdAt: string;            // ISO-8601 datetime
}
```

### Customer (Company)
```typescript
{
  id: string;
  email: string;
  customerType: "COMPANY";
  title: "M/S" | "LLC" | "FZE" | "FZCO";
  companyName: string;
  tradeLicenseId: string;
  phoneNumber1: string;
  phoneNumber2?: string;
  address: string;
  agentType: "Direct" | "Agent";
  accountExecutive?: string;
  customerTypeCategory?: string;
  currency: "AED" | "USD" | "EUR";
  creditLimit?: number;
  creditTerm?: number;
  monthlyIncome?: number;
  trnNumber?: string;
  createdAt: string;
}
```

### OTP (One-Time Password)
```typescript
{
  id: string;           // Email address
  otp: string;          // 6-digit numeric code
  ttl: number;          // Time-to-live (300 seconds)
}
```

---

## 🔌 API Endpoints

### Authentication

#### **POST** `/api/auth/signup/individual`
Create a new individual customer account.

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+971501234567",
  "address": "Dubai, UAE",
  "dateOfBirth": "1990-01-15",
  "emiratesId": "784-1990-1234567-1",
  "passportNumber": "N1234567",
  "nationality": "UAE",
  "agentType": "Direct",
  "accountExecutive": "Sarah Johnson",
  "customerTypeCategory": "Premium",
  "currency": "AED",
  "creditLimit": 50000,
  "creditTerm": 30,
  "monthlyIncome": 15000
}
```

**Response (201):**
```json
{
  "message": "Customer created successfully",
  "customer": {
    "id": "a8f2a507-7cb7-451d-803e-cd7f6572cf28",
    "email": "john.doe@example.com",
    "customerType": "INDIVIDUAL",
    "firstName": "John",
    "lastName": "Doe",
    ...
  }
}
```

---

#### **POST** `/api/auth/signup/company`
Create a new company customer account.

**Request Body:**
```json
{
  "email": "info@company.com",
  "title": "LLC",
  "companyName": "Tech Solutions LLC",
  "tradeLicenseId": "CN-1234567",
  "phoneNumber1": "+971501234567",
  "phoneNumber2": "+971502345678",
  "address": "Dubai Silicon Oasis, UAE",
  "agentType": "Agent",
  "accountExecutive": "Ahmed Ali",
  "customerTypeCategory": "Enterprise",
  "currency": "AED",
  "creditLimit": 200000,
  "creditTerm": 60,
  "monthlyIncome": 500000,
  "trnNumber": "100123456789003"
}
```

**Response (201):**
```json
{
  "message": "Customer created successfully",
  "customer": {
    "id": "b7c3d892-8def-4abc-912f-ef7a8b9c0123",
    "email": "info@company.com",
    "customerType": "COMPANY",
    ...
  }
}
```

---

#### **POST** `/api/auth/login`
Request an OTP for email-based login.

**Request Body:**
```json
{
  "email": "john.doe@example.com"
}
```

**Response (200):**
```json
{
  "message": "OTP sent to email"
}
```

**Note:** OTP is sent to the email via Mailtrap. Valid for 5 minutes.

---

#### **POST** `/api/auth/verify-otp`
Verify OTP and authenticate user.

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "message": "OTP verified",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "customer": {
    "id": "a8f2a507-7cb7-451d-803e-cd7f6572cf28",
    "email": "john.doe@example.com",
    "customerType": "INDIVIDUAL",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

---

### Customer Management

#### **GET** `/api/customers`
List all customers (with optional filtering).

**Query Parameters:**
- `customerType` (optional): Filter by "INDIVIDUAL" or "COMPANY"

**Response (200):**
```json
{
  "customers": [
    {
      "id": "a8f2a507-7cb7-451d-803e-cd7f6572cf28",
      "email": "john.doe@example.com",
      "customerType": "INDIVIDUAL",
      "firstName": "John",
      "lastName": "Doe",
      ...
    }
  ]
}
```

---

#### **GET** `/api/customers/{id}`
Get a specific customer by ID.

**Response (200):**
```json
{
  "id": "a8f2a507-7cb7-451d-803e-cd7f6572cf28",
  "email": "john.doe@example.com",
  "customerType": "INDIVIDUAL",
  "firstName": "John",
  "lastName": "Doe",
  ...
}
```

---

#### **PUT** `/api/customers/{id}`
Update customer details.

**Request Body:** (Same structure as signup, partial updates supported)

**Response (200):**
```json
{
  "message": "Customer updated successfully",
  "customer": { ... }
}
```

---

#### **DELETE** `/api/customers/{id}`
Delete a customer.

**Response (200):**
```json
{
  "message": "Customer deleted successfully"
}
```

---

## 🎯 Features

### 1. **Multi-Tenant Customer Management**
- Support for both individual and corporate customers
- Flexible schema with optional fields
- Unique email constraint

### 2. **Email-Based Authentication (OTP)**
- Passwordless login via One-Time Password
- 6-digit numeric OTP
- 5-minute expiry (TTL in Cosmos DB)
- Email delivery via Mailtrap (SMTP)

### 3. **Event-Driven Architecture**
- Publishes events to Azure Event Grid:
  - `customer.created`
  - `customer.updated`
  - `customer.deleted`
- Enables other services to react to customer changes

### 4. **Email Notifications**
- Professional HTML email templates
- Plain text fallback
- Automated OTP delivery

---

## ⚙️ Configuration

### Environment Variables

**Local Development (`local.settings.json`):**
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "COSMOS_DB_ENDPOINT": "https://localhost:8081",
    "COSMOS_DB_KEY": "<emulator-key>",
    "COSMOS_DB_DATABASE_NAME": "CustomerDB",
    "EVENT_GRID_TOPIC_ENDPOINT": "https://mock-event-grid.local",
    "EVENT_GRID_TOPIC_KEY": "mock-key",
    "EMAIL_HOST": "sandbox.smtp.mailtrap.io",
    "EMAIL_PORT": "2525",
    "EMAIL_USER": "<mailtrap-user>",
    "EMAIL_PASS": "<mailtrap-pass>",
    "JWT_SECRET": "<your-secret-key>"
  }
}
```

**Production (Azure App Settings):**
- Same environment variables
- Use real Cosmos DB endpoint and keys
- Use real Event Grid topic endpoint and keys
- Configure via Azure Portal or CLI

---

## 📦 Database Schema

### Cosmos DB Configuration
- **Database Name:** `CustomerDB`
- **Container Name:** `customers`
- **Partition Key:** `/id`
- **Indexing Policy:** Default (all properties indexed)

### OTP Container
- **Container Name:** `otps`
- **Partition Key:** `/id`
- **Default TTL:** Enabled (items auto-delete after expiry)

---

## 🚀 Deployment

### Prerequisites
- Azure account
- Azure CLI installed and authenticated
- Node.js 20 LTS
- Azure Functions Core Tools v4

### Deploy to Azure Functions

1. **Create Resource Group:**
```bash
az group create --name customer-service-rg --location uaenorth
```

2. **Create Storage Account:**
```bash
az storage account create \
  --name customerstorage$(date +%s) \
  --resource-group customer-service-rg \
  --location uaenorth \
  --sku Standard_LRS
```

3. **Create Cosmos DB Account:**
```bash
az cosmosdb create \
  --name customer-cosmos-db \
  --resource-group customer-service-rg \
  --locations regionName=uaenorth
```

4. **Create Database and Containers:**
```bash
# Create database
az cosmosdb sql database create \
  --account-name customer-cosmos-db \
  --resource-group customer-service-rg \
  --name CustomerDB

# Create customers container
az cosmosdb sql container create \
  --account-name customer-cosmos-db \
  --database-name CustomerDB \
  --resource-group customer-service-rg \
  --name customers \
  --partition-key-path "/id"

# Create OTPs container with TTL
az cosmosdb sql container create \
  --account-name customer-cosmos-db \
  --database-name CustomerDB \
  --resource-group customer-service-rg \
  --name otps \
  --partition-key-path "/id" \
  --ttl -1
```

5. **Create Function App:**
```bash
az functionapp create \
  --resource-group customer-service-rg \
  --name customer-service-func \
  --storage-account customerstorage123456 \
  --consumption-plan-location uaenorth \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4
```

6. **Configure App Settings:**
```bash
COSMOS_CONNECTION=$(az cosmosdb keys list \
  --name customer-cosmos-db \
  --resource-group customer-service-rg \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" -o tsv)

az functionapp config appsettings set \
  --name customer-service-func \
  --resource-group customer-service-rg \
  --settings \
  COSMOS_DB_CONNECTION_STRING="$COSMOS_CONNECTION" \
  COSMOS_DB_DATABASE_NAME="CustomerDB" \
  EMAIL_HOST="sandbox.smtp.mailtrap.io" \
  EMAIL_PORT="2525" \
  EMAIL_USER="<your-user>" \
  EMAIL_PASS="<your-pass>" \
  JWT_SECRET="<your-secret>"
```

7. **Deploy Code:**
```bash
cd customer-service
npm install
npm run build
func azure functionapp publish customer-service-func
```

---

## 🧪 Local Development

### Setup

1. **Install Dependencies:**
```bash
cd customer-service
npm install
```

2. **Start Cosmos DB Emulator:**
```bash
# On Windows
# Start Cosmos DB Emulator from Start Menu

# On Linux/Mac (use Docker)
docker run -p 8081:8081 -p 10251:10251 -p 10252:10252 -p 10253:10253 -p 10254:10254 \
  -e AZURE_COSMOS_EMULATOR_PARTITION_COUNT=10 \
  -e AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=false \
  mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator
```

3. **Create Local Database:**
```bash
# Access emulator at https://localhost:8081/_explorer/index.html
# Create database 'CustomerDB' with containers 'customers' and 'otps'
```

4. **Configure Environment:**
- Copy `local.settings.json.example` to `local.settings.json`
- Update with your Mailtrap credentials

5. **Start Service:**
```bash
npm start
```

Service runs on: `http://localhost:7071`

---

## 📝 Testing

### Test Individual Signup
```bash
curl -X POST http://localhost:7071/api/auth/signup/individual \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "phoneNumber": "+971501234567",
    "agentType": "Direct",
    "currency": "AED"
  }'
```

### Test Login (OTP Request)
```bash
curl -X POST http://localhost:7071/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Test OTP Verification
```bash
curl -X POST http://localhost:7071/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otp": "123456"
  }'
```

### List Customers
```bash
curl http://localhost:7071/api/customers
```

---

## 🔒 Security Considerations

### Current Implementation
- ✅ OTP-based authentication
- ✅ JWT tokens for session management
- ✅ Email uniqueness enforcement
- ✅ TTL-based OTP expiry
- ⚠️ **Auth Level:** Currently set to `anonymous` for development

### Production Recommendations
1. **Enable Function-Level Authentication:**
   - Change `authLevel` from `anonymous` to `function`
   - Implement API key validation

2. **Add JWT Middleware:**
   - Validate JWT tokens on protected endpoints
   - Implement token refresh mechanism

3. **Rate Limiting:**
   - Limit OTP requests per email (prevent abuse)
   - Implement exponential backoff

4. **HTTPS Only:**
   - Enforce HTTPS in production
   - Configure CORS properly

5. **Secrets Management:**
   - Use Azure Key Vault for secrets
   - Rotate keys regularly

---

## 📊 Monitoring & Logging

### Application Insights
- Automatic instrumentation enabled
- View logs in Azure Portal → Function App → Monitoring → Logs

### Key Metrics to Monitor
- **Function Execution Count:** Track usage
- **Execution Duration:** Performance monitoring
- **Failure Rate:** Error tracking
- **Cosmos DB RU Consumption:** Cost optimization

### Logging Best Practices
```typescript
context.log('INFO: Customer created', { customerId: customer.id });
context.error('ERROR: Failed to create customer', { error: err.message });
```

---

## 🔄 Event Grid Integration

### Published Events

#### **customer.created**
```json
{
  "eventType": "customer.created",
  "subject": "customer/a8f2a507-7cb7-451d-803e-cd7f6572cf28",
  "dataVersion": "1.0",
  "data": {
    "customerId": "a8f2a507-7cb7-451d-803e-cd7f6572cf28",
    "email": "john.doe@example.com",
    "customerType": "INDIVIDUAL"
  }
}
```

#### **customer.updated**
```json
{
  "eventType": "customer.updated",
  "subject": "customer/a8f2a507-7cb7-451d-803e-cd7f6572cf28",
  "dataVersion": "1.0",
  "data": {
    "customerId": "a8f2a507-7cb7-451d-803e-cd7f6572cf28",
    "updatedFields": ["phoneNumber", "address"]
  }
}
```

#### **customer.deleted**
```json
{
  "eventType": "customer.deleted",
  "subject": "customer/a8f2a507-7cb7-451d-803e-cd7f6572cf28",
  "dataVersion": "1.0",
  "data": {
    "customerId": "a8f2a507-7cb7-451d-803e-cd7f6572cf28"
  }
}
```

---

## 🐛 Troubleshooting

### Issue: Cosmos DB Connection Failed
**Solution:**
- Verify `COSMOS_DB_ENDPOINT` and `COSMOS_DB_KEY` in settings
- Check if Cosmos DB emulator is running (local dev)
- Verify firewall rules in Azure Cosmos DB (production)

### Issue: OTP Email Not Received
**Solution:**
- Check Mailtrap credentials in `local.settings.json`
- Verify email service logs: `context.log('OTP sent to email')`
- Check spam folder

### Issue: Event Grid Publishing Failed
**Solution:**
- For local dev: Events are mocked (no actual publishing)
- For production: Verify Event Grid topic endpoint and key
- Check Event Grid topic exists and has correct permissions

---

## 📚 Dependencies

```json
{
  "@azure/cosmos": "^4.0.0",
  "@azure/functions": "^4.0.0",
  "@azure/eventgrid": "^5.0.0",
  "nodemailer": "^6.9.0",
  "jsonwebtoken": "^9.0.0"
}
```

---

## 🎯 Future Enhancements

- [ ] Implement JWT-based authentication middleware
- [ ] Add rate limiting for OTP requests
- [ ] Implement password-based auth (optional)
- [ ] Add customer search and filtering
- [ ] Implement pagination for customer list
- [ ] Add audit logging for all operations
- [ ] Integrate with Azure Active Directory
- [ ] Add automated testing (Jest)
- [ ] Implement CI/CD pipeline

---

## 📞 Support

For issues or questions:
- Check Application Insights logs
- Review Cosmos DB metrics
- Contact: devops@example.com

---

**Version:** 1.0.0  
**Last Updated:** November 2025  
**Maintained By:** Development Team

