#!/bin/bash

# Array of function files to update
FILES=(
  "src/functions/templates/autoSaveFormTemplate.ts"
  "src/functions/templates/softDeleteFormTemplate.ts"
  "src/functions/templates/updateFormTemplate.ts"
  "src/functions/templates/getFormTemplate.ts"
  "src/functions/templates/configureConnectorMappings.ts"
  "src/functions/intakes/autoSaveIntakeForm.ts"
  "src/functions/intakes/submitIntakeForm.ts"
  "src/functions/intakes/getIntakeForm.ts"
)

for file in "${FILES[@]}"; do
  echo "Updating $file..."
  
  # Add import if not present
  if ! grep -q "handlePreflight" "$file"; then
    sed -i "/import.*ensureAuthorized/a import { handlePreflight } from '..\/..\/lib\/corsHelper';" "$file"
  fi
  
  # Add preflight handling after function declaration
  sed -i '/: Promise<HttpResponseInit> => {/a\  const preflightResponse = handlePreflight(request);\n  if (preflightResponse) return preflightResponse;\n' "$file"
  
  # Add OPTIONS to methods array
  sed -i "s/methods: \['\([^']*\)'\]/methods: ['\1', 'OPTIONS']/" "$file"
  sed -i "s/methods: \['\([^']*\)', '\([^']*\)'\]/methods: ['\1', '\2', 'OPTIONS']/" "$file"
done

echo "Done!"
