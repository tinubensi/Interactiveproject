# Form Service

Azure Functions app that manages insurance intake form templates, captures submissions, normalizes payloads for RPA connectors, and integrates with Event Grid.

## Getting Started

```bash
npm install
npm run build
func start
```

Set required environment variables (see `src/lib/config.ts`):

- `COSMOS_DB_ENDPOINT`, `COSMOS_DB_KEY`
- `COSMOS_DB_NAME` (default `form-service`)
- `COSMOS_FORM_DEFINITIONS_CONTAINER`, `COSMOS_INTAKE_FORMS_CONTAINER`
- `EVENT_GRID_TOPIC_ENDPOINT`, `EVENT_GRID_TOPIC_KEY`
- `AUTH_AUDIENCE`, `AUTH_REQUIRED_ROLES` (optional)

## Functions

| Area | Functions |
| --- | --- |
| Template management | `ListFormTemplates`, `CreateFormTemplate`, `AutoSaveFormTemplate`, `GetFormTemplate`, `UpdateFormTemplate`, `SoftDeleteFormTemplate`, `ConfigureConnectorMappings` |
| Intake management | `AutoSaveIntakeForm`, `SubmitIntakeForm`, `GetIntakeForm` |
| Events | `RenewalInitiatedEventHandler` |

See `docs/api.md` for payload examples.

## Tests

```bash
npm test
```

Unit tests cover schema validation and connector normalization logic.

## Infrastructure

Deploy the Azure resources defined under `infra/` (Bicep template + guidance). Configure Event Grid subscription from PolicyService to `RenewalInitiatedEventHandler`.

