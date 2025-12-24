// Cosmos DB Containers module
// This module creates containers for a single database

@description('The name of the Cosmos DB account')
param cosmosAccountName string

@description('The name of the database')
param databaseName string

@description('Array of containers to create')
param containers array

// Reference existing Cosmos account
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' existing = {
  name: cosmosAccountName
}

// Reference existing database
resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-11-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

// Create containers
resource cosmosContainers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-11-15' = [for container in containers: {
  parent: database
  name: container.name
  properties: {
    resource: {
      id: container.name
      partitionKey: {
        paths: [container.partitionKey]
        kind: 'Hash'
      }
      defaultTtl: container.ttl
    }
    options: {}
  }
}]

