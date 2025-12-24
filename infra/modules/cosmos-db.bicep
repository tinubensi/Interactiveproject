// Cosmos DB Account with all databases and containers

@description('The name of the Cosmos DB account')
param accountName string

@description('Location for the Cosmos DB account')
param location string

@description('Tags to apply to the resource')
param tags object = {}

@description('Service configuration loaded from service-config.json')
param serviceConfig object

// Cosmos DB Account
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' = {
  name: accountName
  location: location
  tags: tags
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
        isZoneRedundant: false
      }
    ]
    enableAutomaticFailover: false
    enableMultipleWriteLocations: false
    capabilities: []
  }
}

// Build unique databases list from service config
var uniqueDatabases = union(map(serviceConfig.services, service => service.database), [])

// Create databases array with index mapping
var databasesArray = [for dbName in uniqueDatabases: {
  name: dbName
}]

// Create SQL Databases with shared throughput
resource sqlDatabases 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-11-15' = [for db in databasesArray: {
  parent: cosmosAccount
  name: db.name
  properties: {
    resource: {
      id: db.name
    }
    options: {
      throughput: 400 // Shared throughput across all containers in database
    }
  }
}]

// Create container modules for each service (using module instead of nested loop)
module containerDeployments 'cosmos-containers.bicep' = [for service in serviceConfig.services: {
  name: '${service.database}-containers'
  params: {
    cosmosAccountName: cosmosAccount.name
    databaseName: service.database
    containers: service.containers
  }
  dependsOn: [
    sqlDatabases
  ]
}]

output endpoint string = cosmosAccount.properties.documentEndpoint
output accountName string = cosmosAccount.name
output accountId string = cosmosAccount.id
output primaryKey string = cosmosAccount.listKeys().primaryMasterKey

