// Key Vault RBAC Assignment Module
// This module assigns roles to an existing Key Vault without recreating it

@description('The name of the existing Key Vault')
param keyVaultName string

@description('List of principal IDs that need Key Vault Secrets User access')
param secretUserPrincipalIds array = []

// Reference existing Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
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

output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name

