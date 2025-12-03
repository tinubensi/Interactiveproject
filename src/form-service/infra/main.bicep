param location string = resourceGroup().location
param functionAppName string
param cosmosAccountName string
param eventGridTopicName string

resource storage 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: '${functionAppName}sa'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}

resource hostingPlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${functionAppName}-plan'
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
}

resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp'
  properties: {
    serverFarmId: hostingPlan.id
    siteConfig: {
      appSettings: [
        { name: 'AzureWebJobsStorage'; value: storage.properties.primaryEndpoints.blob }
        { name: 'COSMOS_DB_ENDPOINT'; value: 'https://${cosmosAccountName}.documents.azure.com:443/' }
        { name: 'COSMOS_DB_NAME'; value: 'form-service' }
        { name: 'COSMOS_FORM_DEFINITIONS_CONTAINER'; value: 'form-definitions' }
        { name: 'COSMOS_INTAKE_FORMS_CONTAINER'; value: 'intake-forms' }
      { name: 'COSMOS_PORTAL_REGISTRY_CONTAINER'; value: 'portal-registry' }
      { name: 'COSMOS_UNMAPPED_FIELDS_CONTAINER'; value: 'unmapped-fields' }
        { name: 'EVENT_GRID_TOPIC_ENDPOINT'; value: 'https://${eventGridTopicName}.eventgrid.azure.net/api/events' }
      ]
    }
  }
}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: cosmosAccountName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
      }
    ]
  }
}

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' = {
  name: '${cosmosAccount.name}/form-service'
  properties: {
    resource: {
      id: 'form-service'
    }
  }
}

resource formDefinitions 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  name: '${cosmosAccount.name}/${cosmosDatabase.name}/form-definitions'
  properties: {
    resource: {
      id: 'form-definitions'
      partitionKey: {
        paths: [
          '/insuranceLine'
        ]
        kind: 'Hash'
      }
    }
  }
}

resource intakeForms 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  name: '${cosmosAccount.name}/${cosmosDatabase.name}/intake-forms'
  properties: {
    resource: {
      id: 'intake-forms'
      partitionKey: {
        paths: [
          '/intakeId'
        ]
        kind: 'Hash'
      }
    }
  }
}

resource portalRegistry 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  name: '${cosmosAccount.name}/${cosmosDatabase.name}/portal-registry'
  properties: {
    resource: {
      id: 'portal-registry'
      partitionKey: {
        paths: [
          '/portalId'
        ]
        kind: 'Hash'
      }
    }
  }
}

resource unmappedFields 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  name: '${cosmosAccount.name}/${cosmosDatabase.name}/unmapped-fields'
  properties: {
    resource: {
      id: 'unmapped-fields'
      partitionKey: {
        paths: [
          '/portalId'
        ]
        kind: 'Hash'
      }
    }
  }
}

resource eventGridTopic 'Microsoft.EventGrid/topics@2022-06-15' = {
  name: eventGridTopicName
  location: location
}

