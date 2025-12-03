# Infrastructure Overview

- Deploy `infra/main.bicep` with parameters `functionAppName`, `cosmosAccountName`, and `eventGridTopicName`.
- Bicep provisions:
  - Consumption plan Function App with storage account.
  - Cosmos DB account with `form-service` database and required containers.
  - Event Grid topic for `IntakeFormSubmittedEvent` publishing.
- Grant the Function App access to the Cosmos DB keys (Key Vault or app settings).
- Configure Event Grid subscription from PolicyService to the Function App with the `RenewalInitiatedEventHandler`.

