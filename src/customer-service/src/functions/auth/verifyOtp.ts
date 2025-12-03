import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { VerifyOTPRequest } from '../../types/customer';

export async function verifyOtp(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as VerifyOTPRequest;

    if (!body.email || !body.otp) {
      return {
        status: 400,
        jsonBody: { error: 'Email and OTP are required' },
      };
    }

    // Verify OTP
    const otpRecord = await cosmosService.getOTP(body.email, body.otp);

    if (!otpRecord) {
      return {
        status: 401,
        jsonBody: { error: 'Invalid or expired OTP' },
      };
    }

    // Delete OTP after successful verification
    await cosmosService.deleteOTP(body.email, body.otp);

    // Get customer
    const customer = await cosmosService.getCustomerByEmail(body.email);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Authentication successful',
        customer: {
          id: customer?.id,
          customerType: customer?.customerType,
        },
      },
    };
  } catch (error: any) {
    context.log('Verify OTP error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error', message: error.message },
    };
  }
}

app.http('verifyOtp', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'customers/verify-otp',
  handler: verifyOtp,
});

