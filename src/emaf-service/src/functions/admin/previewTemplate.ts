/**
 * Preview HTML Template (Admin)
 * GET /api/admin/emaf/preview?vendorCode=alsagr
 * POST /api/admin/emaf/preview (with form data in body)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { handlePreflight, withCors } from '../../lib/corsHelper';
import { pdfGeneratorService } from '../../services/pdfGeneratorService';
import { ensureAuthorized } from '../../lib/auth';

// Sample data for testing
const sampleData = {
  policyHolder: {
    fullName: 'Ahmed Mohammed Ali',
    employer: 'ABC Technology LLC',
    nationality: 'United Arab Emirates',
    emiratesId: '784-1234-5678901-2',
    emirate: 'Dubai',
    maritalStatus: 'Married',
    gender: 'Male',
    dateOfBirth: '15/05/1985',
    weight: '75',
    height: '175',
    occupation: 'Software Engineer',
    mobileNumber: '+971 50 123 4567',
    contactNumber: '+971 4 123 4567',
    email: 'ahmed.ali@example.com',
    location: 'Dubai Marina, Dubai, UAE'
  },
  insuredMembers: [
    {
      type: 'Principal',
      name: 'Ahmed Mohammed Ali',
      gender: 'Male',
      maritalStatus: 'Married',
      relation: 'Self',
      dateOfBirth: '15/05/1985',
      height: '175',
      weight: '75'
    },
    {
      type: 'Spouse',
      name: 'Fatima Hassan',
      gender: 'Female',
      maritalStatus: 'Married',
      relation: 'Wife',
      dateOfBirth: '20/08/1988',
      height: '165',
      weight: '60'
    },
    {
      type: 'Dependent 1',
      name: 'Mohammed Ahmed Ali',
      gender: 'Male',
      maritalStatus: 'Single',
      relation: 'Son',
      dateOfBirth: '10/03/2010',
      height: '150',
      weight: '45'
    },
    {
      type: 'Dependent 2',
      name: 'Sara Ahmed Ali',
      gender: 'Female',
      maritalStatus: 'Single',
      relation: 'Daughter',
      dateOfBirth: '25/07/2015',
      height: '120',
      weight: '30'
    }
  ],
  previousInsurance: [
    {
      memberName: 'Ahmed Mohammed Ali',
      insuranceCompany: 'XYZ Insurance',
      expiryDate: '31/12/2025'
    },
    {
      memberName: 'Fatima Hassan',
      insuranceCompany: 'XYZ Insurance',
      expiryDate: '31/12/2025'
    }
  ],
  medicalQuestions: [
    {
      number: 1,
      questionEnglish: 'Have you ever been diagnosed with diabetes?',
      questionArabic: 'هل تم تشخيصك بمرض السكري؟',
      answerYes: false
    },
    {
      number: 2,
      questionEnglish: 'Do you have high blood pressure?',
      questionArabic: 'هل تعاني من ارتفاع ضغط الدم؟',
      answerYes: true,
      details: 'Controlled with medication - Amlodipine 5mg daily'
    },
    {
      number: 3,
      questionEnglish: 'Have you had any surgeries in the past 5 years?',
      questionArabic: 'هل أجريت أي عمليات جراحية في السنوات الخمس الماضية؟',
      answerYes: false
    },
    {
      number: 4,
      questionEnglish: 'Do you smoke or use tobacco products?',
      questionArabic: 'هل تدخن أو تستخدم منتجات التبغ؟',
      answerYes: false
    },
    {
      number: 5,
      questionEnglish: 'Are you currently taking any medications?',
      questionArabic: 'هل تتناول أي أدوية حالياً؟',
      answerYes: true,
      details: 'Amlodipine 5mg for blood pressure'
    }
  ],
  pregnancyDeclaration: {
    isPregnant: false
  },
  signature: {
    applicantName: 'Ahmed Mohammed Ali',
    date: new Date().toLocaleDateString('en-GB')
  }
};

export async function previewTemplate(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    // Check authorization (admin only)
    await ensureAuthorized(request);
    
    const vendorCode = request.query.get('vendorCode') || 'alsagr';
    const format = request.query.get('format') || 'html'; // 'html', 'pdf', or 'screenshot'
    
    let formData = sampleData;
    
    // If POST request, use provided form data
    if (request.method === 'POST') {
      try {
        const body = await request.json() as any;
        if (body.formData) {
          formData = { ...sampleData, ...body.formData };
        }
      } catch (error) {
        context.warn('Failed to parse request body, using sample data');
      }
    }
    
    context.log(`Generating ${format} preview for vendor: ${vendorCode}`);
    
    if (format === 'pdf') {
      // Generate PDF
      const html = await pdfGeneratorService.previewHtml(vendorCode, formData);
      const pdfBuffer = await pdfGeneratorService.generatePdfFromHtml(html);
      
      return withCors(request, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${vendorCode}-preview.pdf"`
        },
        body: pdfBuffer
      });
    } else if (format === 'screenshot') {
      // Generate screenshot (PNG)
      const html = await pdfGeneratorService.previewHtml(vendorCode, formData);
      const screenshot = await pdfGeneratorService.screenshotHtml(html);
      
      return withCors(request, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `inline; filename="${vendorCode}-preview.png"`
        },
        body: screenshot
      });
    } else {
      // Generate HTML
      const html = await pdfGeneratorService.previewHtml(vendorCode, formData);
      
      return withCors(request, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8'
        },
        body: html
      });
    }
  } catch (error: any) {
    context.error('Preview template error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to generate preview',
        details: error.message
      }
    });
  }
}

app.http('previewTemplate', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'manage/emaf/template-preview',
  handler: previewTemplate
});
