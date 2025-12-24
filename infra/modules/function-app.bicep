// Function App module - reusable for each microservice

@description('The name of the Function App')
param functionAppName string

@description('Location for the Function App')
param location string

@description('Tags to apply to the resource')
param tags object = {}

@description('The ID of the App Service Plan')
param appServicePlanId string

@description('The name of the storage account for function runtime')
param storageAccountName string

@description('Application Insights instrumentation key')
param appInsightsInstrumentationKey string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('Cosmos DB endpoint')
param cosmosEndpoint string

@description('Cosmos DB database name for this service')
param cosmosDatabaseName string

@description('Event Grid topic endpoint')
param eventGridTopicEndpoint string

// Event Grid topic key is now stored in Key Vault (no longer passed as parameter)

@description('Key Vault URI')
param keyVaultUri string

@description('Service-to-service URLs map')
param serviceUrls object = {}

@description('Whether this service requires Azure AD configuration')
param requiresAzureAd bool = false

@description('Azure AD Tenant ID (if applicable)')
param azureAdTenantId string = ''

@description('Azure AD Client ID (if applicable)')
param azureAdClientId string = ''

@description('Callback URI for Azure AD (if applicable)')
param authRedirectUri string = ''

@description('Environment name (dev, staging, prod)')
param environmentName string = 'dev'

@description('Frontend application URL for CORS')
param frontendUrl string = 'http://localhost:3000'

@description('Additional allowed CORS origins (optional)')
param additionalCorsOrigins array = []

// Reference existing storage account
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

// Function App
resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: functionAppName
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlanId
    reserved: true
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20'
      alwaysOn: false
      functionAppScaleLimit: 200
      minimumElasticInstanceCount: 0
      appSettings: concat([
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsightsInstrumentationKey
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'COSMOS_ENDPOINT'
          value: cosmosEndpoint
        }
        {
          name: 'COSMOS_DATABASE_ID'
          value: cosmosDatabaseName
        }
        {
          name: 'COSMOS_KEY'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/cosmos-key/)'
        }
        {
          name: 'EVENT_GRID_TOPIC_ENDPOINT'
          value: eventGridTopicEndpoint
        }
        {
          name: 'EVENT_GRID_TOPIC_KEY'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/event-grid-topic-key/)'
        }
        {
          name: 'INTERNAL_SERVICE_KEY'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/internal-service-key/)'
        }
        {
          name: 'JWT_SECRET'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/jwt-secret/)'
        }
      ], 
      // Add service URLs
      map(items(serviceUrls), item => {
        name: item.key
        value: item.value
      }),
      // Add Azure AD settings if required
      requiresAzureAd ? [
        {
          name: 'AZURE_AD_TENANT_ID'
          value: azureAdTenantId
        }
        {
          name: 'AZURE_AD_CLIENT_ID'
          value: azureAdClientId
        }
        {
          name: 'AZURE_AD_CLIENT_SECRET'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/azure-ad-client-secret/)'
        }
        {
          name: 'AUTH_REDIRECT_URI'
          value: authRedirectUri
        }
        {
          name: 'COOKIE_DOMAIN'
          value: 'azurewebsites.net'
        }
        {
          name: 'COOKIE_SECURE'
          value: 'true'
        }
      ] : [])
      cors: {
        allowedOrigins: union(
          [
            'https://portal.azure.com' // Azure Portal for management
            frontendUrl // Frontend application
          ],
          // Add localhost origins for development environments
          environmentName == 'dev' ? [
            'http://localhost:3000'
            'http://localhost:3001'
            'http://127.0.0.1:3000'
          ] : [],
          // Add wildcard for inter-service communication within Azure
          [
            'https://*.azurewebsites.net'
          ],
          // Add any additional origins provided
          additionalCorsOrigins
        )
        supportCredentials: true
      }
      ftpsState: 'Disabled'
    }
  }
}

output functionAppName string = functionApp.name
output functionAppId string = functionApp.id
output principalId string = functionApp.identity.principalId
output defaultHostName string = functionApp.properties.defaultHostName
output url string = 'https://${functionApp.properties.defaultHostName}'

