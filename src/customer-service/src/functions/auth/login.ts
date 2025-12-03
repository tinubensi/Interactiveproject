import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { emailService } from '../../services/emailService';
import { LoginRequest } from '../../types/customer';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function login(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as LoginRequest;

    if (!body.email) {
      return {
        status: 400,
        jsonBody: { error: 'Email is required' },
      };
    }

    // Check if customer exists
    const customer = await cosmosService.getCustomerByEmail(body.email);
    if (!customer) {
      return {
        status: 404,
        jsonBody: { error: 'Customer not found' },
      };
    }

    // Generate OTP
    const otp = generateOTP();
    const ttlSeconds = 300; // 5 minutes

    // Save OTP to Cosmos DB
    await cosmosService.saveOTP(body.email, otp, ttlSeconds);

    // Send OTP email
    try {
      const customerName = customer.customerType === 'INDIVIDUAL' 
        ? `${customer.firstName} ${customer.lastName}`.trim()
        : customer.companyName;

      await emailService.sendOTPEmail({
        to: body.email,
        otp,
        customerName,
      });

      context.log(`OTP email sent to ${body.email}`);
    } catch (emailError: any) {
      context.error('Failed to send OTP email:', emailError);
      // Continue even if email fails - user can still use OTP from logs in dev
    }

    return {
      status: 200,
      jsonBody: {
        message: 'OTP sent to your email',
      },
    };
  } catch (error: any) {
    context.log('Login error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error', message: error.message },
    };
  }
}

app.http('login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'customers/login',
  handler: login,
});

