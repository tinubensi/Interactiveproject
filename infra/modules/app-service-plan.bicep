// App Service Plan for Azure Functions (Consumption Plan)

@description('The name of the App Service Plan')
param name string

@description('Location for the App Service Plan')
param location string

@description('Tags to apply to the resource')
param tags object = {}

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  kind: 'functionapp'
  properties: {
    reserved: true // Linux
  }
}

output id string = appServicePlan.id
output name string = appServicePlan.name

