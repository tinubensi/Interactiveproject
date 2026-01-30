import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { UpdateProfileRequest, Customer } from '../../types/customer';
import { ensureAuthorized, requirePermission, CUSTOMER_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function updateProfile(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, CUSTOMER_PERMISSIONS.CUSTOMERS_UPDATE);
    const id = request.params.id;
    const body = (await request.json()) as UpdateProfileRequest;

    if (!id) {
      return withCors(request, {
        status: 400,
        jsonBody: { error: 'Customer ID is required' },
      });
    }

    const existingCustomer = await cosmosService.getCustomerById(id);
    if (!existingCustomer) {
      return withCors(request, {
        status: 404,
        jsonBody: { error: 'Customer not found' },
      });
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

    // Handle medical form fields for individual customers
    if (existingCustomer.customerType === 'INDIVIDUAL') {
      if (body.emirate !== undefined) {
        updates.emirate = body.emirate;
        updatedFields.push('emirate');
      }
      if (body.countryOfResidence !== undefined) {
        updates.countryOfResidence = body.countryOfResidence;
        updatedFields.push('countryOfResidence');
      }
      if (body.dateOfBirth !== undefined) {
        updates.dateOfBirth = body.dateOfBirth;
        updatedFields.push('dateOfBirth');
      }
      if (body.gender !== undefined) {
        updates.gender = body.gender;
        updatedFields.push('gender');
      }
      if (body.nationality !== undefined) {
        updates.nationality = body.nationality;
        updatedFields.push('nationality');
      }
      if (body.emiratesId !== undefined) {
        // Check for duplicate Emirates ID (excluding current customer)
        if (body.emiratesId && body.emiratesId.trim() !== '') {
          const existingByEmiratesId = await cosmosService.getCustomerByEmiratesId(body.emiratesId);
          if (existingByEmiratesId && existingByEmiratesId.id !== id) {
            return withCors(request, {
              status: 409,
              jsonBody: { error: 'Customer with this Emirates ID already exists' },
            });
          }
        }
        updates.emiratesId = body.emiratesId;
        updatedFields.push('emiratesId');
      }
      if (body.monthlySalaryRange !== undefined) {
        updates.monthlySalaryRange = body.monthlySalaryRange;
        updatedFields.push('monthlySalaryRange');
      }
      if (body.visaType !== undefined) {
        updates.visaType = body.visaType;
        updatedFields.push('visaType');
      }
      if (body.maritalStatus !== undefined) {
        updates.maritalStatus = body.maritalStatus;
        updatedFields.push('maritalStatus');
      }
      if (body.passportNumber !== undefined) {
        updates.passportNumber = body.passportNumber;
        updatedFields.push('passportNumber');
      }
      if (body.visaFileNumber !== undefined) {
        updates.visaFileNumber = body.visaFileNumber;
        updatedFields.push('visaFileNumber');
      }
      if (body.visaExpiryDate !== undefined) {
        updates.visaExpiryDate = body.visaExpiryDate;
        updatedFields.push('visaExpiryDate');
      }
      if (body.visaLocation !== undefined) {
        updates.visaLocation = body.visaLocation;
        updatedFields.push('visaLocation');
      }
      if (body.occupation !== undefined) {
        updates.occupation = body.occupation;
        updatedFields.push('occupation');
      }
      if (body.homeCountry !== undefined) {
        updates.homeCountry = body.homeCountry;
        updatedFields.push('homeCountry');
      }
      if (body.mobileNumber !== undefined) {
        updates.mobileNumber = body.mobileNumber;
        updatedFields.push('mobileNumber');
      }
      if (body.faxNumber !== undefined) {
        updates.faxNumber = body.faxNumber;
        updatedFields.push('faxNumber');
      }
      if (body.title !== undefined) {
        updates.title = body.title;
        updatedFields.push('title');
      }
      if (body.middleName !== undefined) {
        updates.middleName = body.middleName;
        updatedFields.push('middleName');
      }
      if (body.email2 !== undefined) {
        updates.email2 = body.email2;
        updatedFields.push('email2');
      }
      if (body.placementExecutive !== undefined) {
        updates.placementExecutive = body.placementExecutive;
        updatedFields.push('placementExecutive');
      }
      if (body.customerTypeCategory !== undefined) {
        updates.customerTypeCategory = body.customerTypeCategory;
        updatedFields.push('customerTypeCategory');
      }
      if (body.currency !== undefined) {
        updates.currency = body.currency;
        updatedFields.push('currency');
      }
    }

    if (updatedFields.length === 0) {
      return withCors(request, {
        status: 400,
        jsonBody: { error: 'No valid fields to update' },
      });
    }

    const updatedCustomer = await cosmosService.updateCustomer(id, updates);

    // Publish event
    await eventGridService.publishCustomerProfileUpdatedEvent({
      id: updatedCustomer.id,
      updatedFields,
    });

    return withCors(request, {
      status: 200,
      jsonBody: updatedCustomer,
    });
  } catch (error: any) {
    context.log('Update profile error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { error: 'Internal server error', message: error.message },
    });
  }
}

app.http('updateProfile', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customers/{id}/profile',
  handler: updateProfile,
});

