/**
 * Inspect PDF Form Fields (Admin)
 * GET /api/manage/templates/{id}/inspect-pdf-fields?vendorId={vendorId}
 * 
 * Inspects the vendor PDF to discover all form fields (checkboxes, text fields, etc.)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { PDFDocument } from 'pdf-lib';
import { cosmosService } from '../../services/cosmosService';
import { blobService } from '../../services/blobService';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function inspectPdfFields(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const templateId = request.params.id;
    const vendorId = request.query.get('vendorId');

    if (!templateId || !vendorId) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'templateId and vendorId are required'
        }
      });
    }

    context.log(`Inspecting PDF fields for template ${templateId}, vendor ${vendorId}`);

    // Get template
    const template = await cosmosService.getEmafTemplateById(templateId, vendorId);
    
    if (!template) {
      return withCors(request, {
        status: 404,
        jsonBody: {
          success: false,
          error: 'Template not found'
        }
      });
    }

    if (!template.vendorPdfBlobPath) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Template has no vendor PDF uploaded'
        }
      });
    }

    // Download and load PDF
    context.log(`Loading PDF from: ${template.vendorPdfBlobPath}`);
    const pdfBuffer = await blobService.downloadBlob(template.vendorPdfBlobPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    
    // Get form and fields
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    context.log(`Found ${fields.length} form fields`);
    
    // Extract field information
    const fieldInfo = fields.map((field, index) => {
      const name = field.getName();
      const type = field.constructor.name;
      
      const info: any = {
        index: index + 1,
        name,
        type
      };
      
      // Add type-specific information
      if (type.includes('CheckBox')) {
        try {
          const checkbox = form.getCheckBox(name);
          info.checked = checkbox.isChecked();
        } catch (e) {
          info.checked = false;
        }
      } else if (type.includes('TextField')) {
        try {
          const textField = form.getTextField(name);
          info.value = textField.getText() || '';
        } catch (e) {
          info.value = '';
        }
      }
      
      return info;
    });
    
    // Group by type
    const groupedFields = {
      checkboxes: fieldInfo.filter(f => f.type.includes('CheckBox')),
      textFields: fieldInfo.filter(f => f.type.includes('TextField')),
      radioButtons: fieldInfo.filter(f => f.type.includes('RadioButton')),
      dropdowns: fieldInfo.filter(f => f.type.includes('Dropdown')),
      others: fieldInfo.filter(f => 
        !f.type.includes('CheckBox') && 
        !f.type.includes('TextField') && 
        !f.type.includes('RadioButton') && 
        !f.type.includes('Dropdown')
      )
    };

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          totalPages: pdfDoc.getPageCount(),
          totalFields: fields.length,
          fields: fieldInfo,
          fieldsByType: groupedFields,
          summary: {
            checkboxes: groupedFields.checkboxes.length,
            textFields: groupedFields.textFields.length,
            radioButtons: groupedFields.radioButtons.length,
            dropdowns: groupedFields.dropdowns.length,
            others: groupedFields.others.length
          }
        }
      }
    });
  } catch (error: any) {
    context.error('Inspect PDF fields error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to inspect PDF fields',
        details: error.message
      }
    });
  }
}

app.http('inspectPdfFields', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'manage/templates/{id}/inspect-pdf-fields',
  handler: inspectPdfFields
});
