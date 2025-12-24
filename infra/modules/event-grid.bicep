// Event Grid Topic for event-driven architecture

@description('The name of the Event Grid topic')
param name string

@description('Location for the Event Grid topic')
param location string

@description('Tags to apply to the resource')
param tags object = {}

resource eventGridTopic 'Microsoft.EventGrid/topics@2023-12-15-preview' = {
  name: name
  location: location
  tags: tags
  properties: {
    inputSchema: 'CloudEventSchemaV1_0'
    publicNetworkAccess: 'Enabled'
  }
}

output id string = eventGridTopic.id
output name string = eventGridTopic.name
output endpoint string = eventGridTopic.properties.endpoint
output key string = eventGridTopic.listKeys().key1

