import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { UpdateProfileRequest, Customer } from '../../types/customer';

export async function updateProfile(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const id = request.params.id;
    const body = (await request.json()) as UpdateProfileRequest;

    if (!id) {
      return {
        status: 400,
        jsonBody: { error: 'Customer ID is required' },
      };
    }

    const existingCustomer = await cosmosService.getCustomerById(id);
    if (!existingCustomer) {
      return {
        status: 404,
        jsonBody: { error: 'Customer not found' },
      };
    }

    const updatedFields: string[] = [];
    const updates: any = {};

    if (body.companyName !== undefined) {
      if (existingCustomer.customerType === 'COMPANY') {
        updates.companyName = body.companyName;
        updatedFields.push('companyName');
      }
    }

    if (body.tradeLicense !== undefined) {
      if (existingCustomer.customerType === 'COMPANY') {
        updates.tradeLicenseId = body.tradeLicense;
        updatedFields.push('tradeLicenseId');
      }
    }

    if (body.firstName !== undefined) {
      if (existingCustomer.customerType === 'INDIVIDUAL') {
        updates.firstName = body.firstName;
        updatedFields.push('firstName');
      }
    }

    if (body.lastName !== undefined) {
      if (existingCustomer.customerType === 'INDIVIDUAL') {
        updates.lastName = body.lastName;
        updatedFields.push('lastName');
      }
    }

    // Update name field when firstName or lastName changes
    if (existingCustomer.customerType === 'INDIVIDUAL' && (body.firstName !== undefined || body.lastName !== undefined)) {
      const firstName = body.firstName !== undefined ? body.firstName : existingCustomer.firstName;
      const lastName = body.lastName !== undefined ? body.lastName : existingCustomer.lastName;
      updates.name = `${firstName} ${lastName}`.trim();
      if (!updatedFields.includes('name')) {
        updatedFields.push('name');
      }
    }

    // Handle other fields (email, phone, address, etc.)
    if (body.email !== undefined) {
      if (existingCustomer.customerType === 'INDIVIDUAL') {
        updates.email = body.email;
      } else {
        updates.email1 = body.email;
      }
      updatedFields.push('email');
    }

    if (body.phoneNumber !== undefined) {
      if (existingCustomer.customerType === 'INDIVIDUAL') {
        updates.phoneNumber = body.phoneNumber;
      } else {
        updates.phoneNumber1 = body.phoneNumber;
      }
      updatedFields.push('phoneNumber');
    }

    if (body.address !== undefined) {
      updates.address = body.address;
      updatedFields.push('address');
    }

    if (updatedFields.length === 0) {
      return {
        status: 400,
        jsonBody: { error: 'No valid fields to update' },
      };
    }

    const updatedCustomer = await cosmosService.updateCustomer(id, updates);

    // Publish event
    await eventGridService.publishCustomerProfileUpdatedEvent({
      id: updatedCustomer.id,
      updatedFields,
    });

    return {
      status: 200,
      jsonBody: updatedCustomer,
    };
  } catch (error: any) {
    context.log('Update profile error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error', message: error.message },
    };
  }
}

app.http('updateProfile', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'customers/{id}/profile',
  handler: updateProfile,
});

