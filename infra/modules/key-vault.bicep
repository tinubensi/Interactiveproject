// Key Vault for secrets management

@description('The name of the Key Vault')
param name string

@description('Location for the Key Vault')
param location string

@description('Tags to apply to the resource')
param tags object = {}

@description('List of principal IDs that need Key Vault Secrets User access')
param secretUserPrincipalIds array = []

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// Key Vault Secrets User role definition ID
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

// Grant Key Vault Secrets User role to each principal
resource secretUserRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for principalId in secretUserPrincipalIds: {
  name: guid(keyVault.id, principalId, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}]

output id string = keyVault.id
output name string = keyVault.name
output vaultUri string = keyVault.properties.vaultUri

