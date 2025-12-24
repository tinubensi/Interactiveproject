// Main Bicep orchestrator for Nectaria Infrastructure
targetScope = 'subscription'

@description('Environment name (dev, staging, prod)')
param environment string

@description('Primary Azure region')
param location string = 'uaenorth'

@description('Resource naming prefix')
param prefix string = 'nectaria'

@description('Azure AD Tenant ID for authentication service')
param azureAdTenantId string = ''

@description('Azure AD Client ID for authentication service')
param azureAdClientId string = ''

@description('Frontend application URL for CORS configuration')
param frontendUrl string = ''

@description('Tags for all resources')
param tags object = {
  environment: environment
  project: 'nectaria'
  managedBy: 'bicep'
  deployedAt: utcNow()
}

// Load service configuration
var serviceConfig = loadJsonContent('service-config.json')

// Resource Group
resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'rg-${prefix}-${environment}'
  location: location
  tags: tags
}

// Application Insights (needed first for function apps)
module appInsights 'modules/app-insights.bicep' = {
  name: 'appInsights-deployment'
  scope: rg
  params: {
    name: 'appi-${prefix}-${environment}'
    location: location
    tags: tags
  }
}

// Storage Account for Function Apps
module functionStorage 'modules/storage.bicep' = {
  name: 'functionStorage-deployment'
  scope: rg
  params: {
    name: 'st${prefix}func${environment}'
    location: location
    tags: tags
  }
}

// Storage Account for Document Service
module documentStorage 'modules/storage.bicep' = {
  name: 'documentStorage-deployment'
  scope: rg
  params: {
    name: 'st${prefix}docs${environment}'
    location: location
    tags: tags
  }
}

// Cosmos DB with all databases and containers
module cosmosDb 'modules/cosmos-db.bicep' = {
  name: 'cosmosDb-deployment'
  scope: rg
  params: {
    accountName: 'cosmos-${prefix}-${environment}'
    location: location
    tags: tags
    serviceConfig: serviceConfig
  }
}

// Event Grid Topic
module eventGrid 'modules/event-grid.bicep' = {
  name: 'eventGrid-deployment'
  scope: rg
  params: {
    name: 'egt-${prefix}-events-${environment}'
    location: location
    tags: tags
  }
}

// App Service Plan (Consumption)
module appServicePlan 'modules/app-service-plan.bicep' = {
  name: 'appServicePlan-deployment'
  scope: rg
  params: {
    name: 'asp-${prefix}-consumption-${environment}'
    location: location
    tags: tags
  }
}

// Key Vault (created first, RBAC assigned after function apps are created)
module keyVault 'modules/key-vault.bicep' = {
  name: 'keyVault-deployment'
  scope: rg
  params: {
    name: 'kv-${prefix}-${environment}'
    location: location
    tags: tags
    secretUserPrincipalIds: [] // Empty initially, RBAC assigned separately below
  }
}

// Build service URLs map for inter-service communication
var serviceUrlsMap = reduce(serviceConfig.services, {}, (acc, service) => union(acc, {
  '${toUpper(replace(service.name, '-', '_'))}_SERVICE_URL': 'https://func-${prefix}-${service.name}-${environment}.azurewebsites.net'
}))

// Deploy Function Apps for all services
module functionApps 'modules/function-app.bicep' = [for service in serviceConfig.services: {
  name: '${service.name}-service-deployment'
  scope: rg
  params: {
    functionAppName: 'func-${prefix}-${service.name}-${environment}'
    location: location
    tags: union(tags, {
      service: service.name
    })
    appServicePlanId: appServicePlan.outputs.id
    storageAccountName: functionStorage.outputs.name
    appInsightsInstrumentationKey: appInsights.outputs.instrumentationKey
    appInsightsConnectionString: appInsights.outputs.connectionString
    cosmosEndpoint: cosmosDb.outputs.endpoint
    cosmosDatabaseName: service.database
    eventGridTopicEndpoint: eventGrid.outputs.endpoint
    keyVaultUri: keyVault.outputs.vaultUri
    serviceUrls: serviceUrlsMap
    requiresAzureAd: contains(service, 'requiresAzureAd') ? service.?requiresAzureAd ?? false : false
    azureAdTenantId: azureAdTenantId
    azureAdClientId: azureAdClientId
    authRedirectUri: 'https://func-${prefix}-${service.name}-${environment}.azurewebsites.net/api/auth/callback/b2b'
    environmentName: environment
    frontendUrl: !empty(frontendUrl) ? frontendUrl : (environment == 'dev' ? 'http://localhost:3000' : 'https://${prefix}-${environment}.azurewebsites.net')
    additionalCorsOrigins: []
  }
}]

// Assign Key Vault RBAC to all function apps (references existing vault)
module keyVaultRbac 'modules/key-vault-rbac.bicep' = {
  name: 'keyVault-rbac-deployment'
  scope: rg
  params: {
    keyVaultName: 'kv-${prefix}-${environment}'
    secretUserPrincipalIds: [for (service, i) in serviceConfig.services: functionApps[i].outputs.principalId]
  }
  dependsOn: [
    functionApps // Explicit dependency to ensure managed identities exist
  ]
}

// Outputs
output resourceGroupName string = rg.name
output location string = location
output cosmosDbEndpoint string = cosmosDb.outputs.endpoint
output cosmosDbAccountName string = cosmosDb.outputs.accountName
output eventGridTopicEndpoint string = eventGrid.outputs.endpoint
output eventGridTopicName string = eventGrid.outputs.name
output keyVaultUri string = keyVault.outputs.vaultUri
output keyVaultName string = keyVault.outputs.name
output appInsightsName string = appInsights.outputs.name
output functionStorageAccountName string = functionStorage.outputs.name
output documentStorageAccountName string = documentStorage.outputs.name
output functionApps array = [for (service, i) in serviceConfig.services: {
  serviceName: service.name
  functionAppName: functionApps[i].outputs.functionAppName
  url: functionApps[i].outputs.url
  principalId: functionApps[i].outputs.principalId
}]

