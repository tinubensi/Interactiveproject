# EMAF Service Integration Guide

## Integration with Quotation Service

### Step 1: Update selectPlan Function

File: `quotation-service/src/functions/customer/selectPlan.ts`

Add EMAF check after plan selection (around line 140):

```typescript
// After this line:
const selectedPlan = plans.find(p => p.id === planId || p.planId === planId);

// Add this code:
import axios from 'axios';

// Check if vendor has published EMAF template
try {
  const emafCheckResponse = await axios.get(
    `${process.env.EMAF_SERVICE_URL}/api/admin/emaf/templates/${selectedPlan.vendorId}`,
    {
      headers: {
        'X-Service-Key': process.env.SERVICE_KEY
      },
      validateStatus: (status) => status < 500 // Don't throw on 404
    }
  );

  if (emafCheckResponse.status === 200) {
    const emafTemplate = emafCheckResponse.data.data;
    
    // Only proceed if template is published
    if (emafTemplate.status === 'published') {
      context.log(`Vendor ${selectedPlan.vendorName} has published EMAF template`);
      
      // Create EMAF submission
      const emafResponse = await axios.post(
        `${process.env.EMAF_SERVICE_URL}/api/internal/submissions/create`,
        {
          leadId: quotation.leadId,
          quotationId: quotation.id,
          selectedPlanId: planId,
          vendorId: selectedPlan.vendorId,
          vendorCode: selectedPlan.vendorCode,
          vendorName: selectedPlan.vendorName,
          customerId: quotation.customerId,
          customerName: quotation.leadSnapshot?.firstName + ' ' + quotation.leadSnapshot?.lastName,
          customerEmail: quotation.leadSnapshot?.email,
          customerPhone: quotation.leadSnapshot?.phone
        },
        {
          headers: {
            'X-Service-Key': process.env.SERVICE_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const { submissionId } = emafResponse.data.data;
      context.log(`Created EMAF submission: ${submissionId}`);
      
      // Update quotation with EMAF info
      await cosmosService.updateQuotation(quotation.id, quotation.leadId, {
        selectedPlanId: planId,
        requiresEmaf: true,
        emafSubmissionId: submissionId,
        status: 'emaf_pending',
        updatedAt: new Date()
      });
      
      // Mark plan as selected
      await cosmosService.updateQuotationPlan(planId, quotation.id, { isSelected: true });
      
      // Update token usage
      await cosmosService.markTokenAsUsed(token);
      
      return withCors(request, {
        status: 200,
        jsonBody: {
          success: true,
          message: 'Plan selected. Please complete the medical application form.',
          requiresEmaf: true,
          emafSubmissionId: submissionId,
          redirectUrl: `/quotation/${token}/emaf`
        }
      });
    }
  }
} catch (emafError: any) {
  // EMAF template not found or error - proceed without EMAF
  context.warn(`No EMAF template for vendor ${selectedPlan.vendorName}:`, emafError.message);
}

// If no EMAF required, proceed with existing flow
// ... existing code continues
```

### Step 2: Update Environment Variables

Add to `quotation-service/local.settings.json`:

```json
{
  "Values": {
    "EMAF_SERVICE_URL": "http://localhost:7078",
    "SERVICE_KEY": "internal-service-key"
  }
}
```

### Step 3: Update Quotation Model

Add to `quotation-service/src/models/quotation.ts`:

```typescript
export interface Quotation {
  // ... existing fields
  requiresEmaf?: boolean;
  emafSubmissionId?: string;
}
```

## Integration with Pipeline Service

### Add Event Handlers

File: `pipeline-service/src/functions/events/handleEmafEvents.ts` (create new)

```typescript
import { app, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';

export async function handleEmafSubmissionSubmitted(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  try {
    const event = eventGridEvent;
    const data = event.data;
    
    context.log(`EMAF submitted for lead ${data.leadId}`);
    
    // Update lead stage to "EMAF Pending Approval"
    await cosmosService.updateLeadStage(data.leadId, {
      stage: 'EMAF Pending Approval',
      stageId: 'stage-emaf-review',
      updatedAt: new Date()
    });
    
    context.log(`Lead ${data.leadId} moved to EMAF Pending Approval stage`);
  } catch (error: any) {
    context.error('Error handling EMAF submission:', error);
  }
}

export async function handleEmafSubmissionApproved(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  try {
    const event = eventGridEvent;
    const data = event.data;
    
    context.log(`EMAF approved for lead ${data.leadId}`);
    
    // Move to policy issuance stage
    await cosmosService.updateLeadStage(data.leadId, {
      stage: 'Policy Issuance',
      stageId: 'stage-policy-issue',
      updatedAt: new Date()
    });
    
    context.log(`Lead ${data.leadId} moved to Policy Issuance stage`);
  } catch (error: any) {
    context.error('Error handling EMAF approval:', error);
  }
}

app.eventGrid('handleEmafSubmissionSubmitted', {
  handler: handleEmafSubmissionSubmitted
});

app.eventGrid('handleEmafSubmissionApproved', {
  handler: handleEmafSubmissionApproved
});
```

Update `pipeline-service/src/index.ts`:

```typescript
import './functions/events/handleEmafEvents';
```

## Frontend Integration

### Customer Portal - EMAF Form Page

File: `frontend/src/app/quotation/[token]/emaf/page.tsx` (create new)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { FormSection } from '@/components/forms/FormSection';
import { DocumentUpload } from '@/components/emaf/DocumentUpload';
import { PdfDownload } from '@/components/emaf/PdfDownload';

export default function EmafPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = params.token as string;
  
  const [emafData, setEmafData] = useState<any>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [pdfStatus, setPdfStatus] = useState('not_generated');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    loadEmafData();
  }, [token]);
  
  const loadEmafData = async () => {
    try {
      const response = await fetch(`/api/customer/emaf/${token}`);
      const result = await response.json();
      
      if (result.success) {
        setEmafData(result.data);
        setFormValues(result.data.submission.formData || {});
        setDocuments(result.data.submission.uploadedDocuments || []);
        
        // Check PDF status
        if (result.data.submission.generatedPdfSasUrl) {
          setPdfStatus('completed');
          setPdfUrl(result.data.submission.generatedPdfSasUrl);
        }
      }
    } catch (error) {
      console.error('Failed to load EMAF:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAutoSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/customer/emaf/${emafData.submission.id}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: emafData.submission.leadId,
          formData: formValues
        })
      });
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setSaving(false);
    }
  };
  
  useEffect(() => {
    // Auto-save every 30 seconds
    const interval = setInterval(handleAutoSave, 30000);
    return () => clearInterval(interval);
  }, [formValues]);
  
  const handleGeneratePdf = async () => {
    await handleAutoSave();
    setPdfStatus('generating');
    
    try {
      const response = await fetch(
        `/api/customer/emaf/${emafData.submission.id}/generate-pdf`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: emafData.submission.leadId })
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        // Poll for PDF status
        pollPdfStatus();
      }
    } catch (error) {
      console.error('PDF generation failed:', error);
      setPdfStatus('failed');
    }
  };
  
  const pollPdfStatus = async () => {
    const interval = setInterval(async () => {
      const response = await fetch(
        `/api/customer/emaf/${emafData.submission.id}/pdf-status?leadId=${emafData.submission.leadId}`
      );
      const result = await response.json();
      
      if (result.data.status === 'completed') {
        setPdfStatus('completed');
        setPdfUrl(result.data.pdfUrl);
        clearInterval(interval);
      } else if (result.data.status === 'failed') {
        setPdfStatus('failed');
        clearInterval(interval);
      }
    }, 2000);
  };
  
  const handleSubmit = async () => {
    try {
      const response = await fetch(
        `/api/customer/emaf/${emafData.submission.id}/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: emafData.submission.leadId })
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        router.push(`/quotation/${token}/emaf/success`);
      }
    } catch (error) {
      console.error('Submission failed:', error);
    }
  };
  
  if (loading) return <div>Loading...</div>;
  if (!emafData) return <div>EMAF not found</div>;
  
  const { template, submission } = emafData;
  
  return (
    <div className="container mx-auto py-8">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-4">{template.name}</h1>
        <p className="text-gray-600 mb-6">Vendor: {submission.vendorName}</p>
        
        {saving && <div className="text-sm text-gray-500 mb-2">Saving...</div>}
        
        {/* Form Sections */}
        {template.sections.map((section: any) => (
          <FormSection
            key={section.id}
            section={section}
            values={formValues}
            onChange={setFormValues}
          />
        ))}
        
        {/* PDF Actions */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Download & Sign</h2>
          {pdfStatus === 'not_generated' && (
            <Button onClick={handleGeneratePdf}>Generate PDF</Button>
          )}
          {pdfStatus === 'generating' && (
            <div>Generating PDF...</div>
          )}
          {pdfStatus === 'completed' && pdfUrl && (
            <PdfDownload url={pdfUrl} />
          )}
        </div>
        
        {/* Document Uploads */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Required Documents</h2>
          {template.requiredDocuments.map((doc: any) => (
            <DocumentUpload
              key={doc.id}
              requirement={doc}
              submission={submission}
              onUploadComplete={loadEmafData}
            />
          ))}
        </div>
        
        {/* Submit Button */}
        <div className="mt-8">
          <Button 
            onClick={handleSubmit}
            disabled={!submission.signedPdfBlobPath}
          >
            Submit for Review
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

### Admin Panel - EMAF Builder

File: `frontend/src/app/admin/emaf/page.tsx` (create new)

Use existing form builder components from form-service to build EMAF templates.

### Staff Portal - Approval Queue

File: `frontend/src/app/approvals/emaf/page.tsx` (create new)

List pending EMAF submissions with approve/reject/revision actions.

## Testing the Integration

### 1. Create EMAF Template
```bash
curl -X POST http://localhost:7078/api/admin/emaf/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -d '{
    "vendorId": "vendor-watania",
    "vendorCode": "watania",
    "vendorName": "Watania International",
    "lineOfBusiness": "medical",
    "name": "Medical Application Form",
    "sections": [...]
  }'
```

### 2. Publish Template
```bash
curl -X POST "http://localhost:7078/api/admin/emaf/templates/{id}/publish?vendorId=vendor-watania" \
  -H "Authorization: Bearer token"
```

### 3. Test Full Flow
1. Create lead
2. Generate quotation with Watania plan
3. Send quotation to customer
4. Customer selects Watania plan
5. EMAF submission created automatically
6. Customer redirected to EMAF form
7. Customer fills form, downloads PDF, uploads signed PDF
8. Customer submits for review
9. Staff approves/rejects

## Event Flow

```
1. Customer selects plan
   → quotation.status = 'emaf_pending'
   → Event: emaf.submission.created

2. Customer completes EMAF
   → submission.status = 'pending_approval'
   → Event: emaf.submission.submitted
   → Lead stage = 'EMAF Pending Approval'

3. Staff approves EMAF
   → submission.status = 'approved'
   → Event: emaf.submission.approved
   → Lead stage = 'Policy Issuance'
   → quotation.status = 'policy_issued'
```

## Troubleshooting

### EMAF Not Triggered
- Check if vendor has published EMAF template
- Verify SERVICE_KEY is configured
- Check EMAF_SERVICE_URL is correct

### PDF Generation Slow
- Check queue length
- Verify blob storage permissions
- Monitor Azure Function logs

### Document Upload Fails
- Check file size limits
- Verify accepted formats
- Check blob storage SAS token expiry
