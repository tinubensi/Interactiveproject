import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { SignupRequest, Customer, IndividualCustomer, CompanyCustomer } from '../../types/customer';

export async function signup(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as SignupRequest;

    // Validate required fields based on customer type
    if (body.customerType === 'INDIVIDUAL') {
      if (!body.firstName || !body.lastName || !body.name || !body.email || !body.gender || !body.agent) {
        return {
          status: 400,
          jsonBody: { error: 'Missing required fields for individual customer' },
        };
      }
    } else if (body.customerType === 'COMPANY') {
      if (!body.companyName || !body.email1 || !body.phoneNumber1 || !body.agent) {
        return {
          status: 400,
          jsonBody: { error: 'Missing required fields for company customer' },
        };
      }
    } else {
      return {
        status: 400,
        jsonBody: { error: 'Invalid customer type. Must be INDIVIDUAL or COMPANY' },
      };
    }

    // Check if customer already exists
    const existingCustomer = await cosmosService.getCustomerByEmail(
      body.customerType === 'INDIVIDUAL' ? body.email! : body.email1!
    );
    if (existingCustomer) {
      return {
        status: 409,
        jsonBody: { error: 'Customer with this email already exists' },
      };
    }

    const now = new Date().toISOString();
    const id = uuidv4();

    let customer: Customer;

    if (body.customerType === 'INDIVIDUAL') {
      customer = {
        id,
        customerType: 'INDIVIDUAL',
        title: body.title,
        firstName: body.firstName!,
        middleName: body.middleName,
        lastName: body.lastName!,
        name: body.name!,
        dateOfBirth: body.dateOfBirth,
        email: body.email!,
        email2: body.email2,
        phoneNumber: body.phoneNumber,
        mobileNumber: body.mobileNumber,
        faxNumber: body.faxNumber,
        emiratesId: body.emiratesId,
        nationality: body.nationality,
        gender: body.gender!,
        address: body.address,
        agent: body.agent!,
        placementExecutive: body.placementExecutive,
        customerTypeCategory: body.customerTypeCategory || 'VERY IMPORTANT PERSON',
        currency: body.currency || 'AED',
        mainCustomer: body.mainCustomer,
        insuredName: body.insuredName,
        creationDate: body.creationDate || now.split('T')[0],
        firstBusinessDate: body.firstBusinessDate || now.split('T')[0],
        documentStatus: 'Pending',
        policies: [],
        contacts: [],
        createdAt: now,
        updatedAt: now,
      } as IndividualCustomer;
    } else {
      customer = {
        id,
        customerType: 'COMPANY',
        title: body.title,
        companyName: body.companyName!,
        tradeLicenseId: body.tradeLicenseId,
        email1: body.email1!,
        email2: body.email2,
        phoneNumber1: body.phoneNumber1!,
        phoneNumber2: body.phoneNumber2,
        faxNumber: body.faxNumber,
        address: body.address,
        address1: body.address1,
        poBox: body.poBox,
        contactPerson: body.contactPerson,
        agent: body.agent!,
        accountExecutive: body.accountExecutive,
        customerTypeCategory: body.customerTypeCategory || 'VERY IMPORTANT PERSON',
        creditLimit: body.creditLimit || 0,
        creditTerm: body.creditTerm || 0,
        monthlyIncome: body.monthlyIncome || 0,
        currency: body.currency || 'AED',
        trnNumber: body.trnNumber,
        mainCustomer: body.mainCustomer,
        insuredName: body.insuredName,
        creationDate: body.creationDate || now.split('T')[0],
        firstBusinessDate: body.firstBusinessDate || now.split('T')[0],
        documentStatus: 'Pending',
        policies: [],
        contacts: [],
        createdAt: now,
        updatedAt: now,
      } as CompanyCustomer;
    }

    const createdCustomer = await cosmosService.createCustomer(customer);

    // Publish event
    await eventGridService.publishCustomerCreatedEvent({
      id: createdCustomer.id,
      customerType: createdCustomer.customerType,
      profile: createdCustomer,
    });

    return {
      status: 201,
      jsonBody: createdCustomer,
    };
  } catch (error: any) {
    context.log('Signup error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error', message: error.message },
    };
  }
}

app.http('signup', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'customers/signup',
  handler: signup,
});

