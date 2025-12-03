import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { AddContactRequest, Customer, Contact } from '../../types/customer';

export async function addContact(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const id = request.params.id;
    const body = (await request.json()) as AddContactRequest;

    if (!id) {
      return {
        status: 400,
        jsonBody: { error: 'Customer ID is required' },
      };
    }

    if (!body.type || !body.value) {
      return {
        status: 400,
        jsonBody: { error: 'Contact type and value are required' },
      };
    }

    if (body.type !== 'email' && body.type !== 'phone') {
      return {
        status: 400,
        jsonBody: { error: 'Contact type must be email or phone' },
      };
    }

    const existingCustomer = await cosmosService.getCustomerById(id);
    if (!existingCustomer) {
      return {
        status: 404,
        jsonBody: { error: 'Customer not found' },
      };
    }

    const newContact: Contact = {
      type: body.type,
      value: body.value,
      addedAt: new Date().toISOString(),
    };

    const contacts = existingCustomer.contacts || [];
    contacts.push(newContact);

    const updatedCustomer = await cosmosService.updateCustomer(id, { contacts });

    return {
      status: 200,
      jsonBody: updatedCustomer,
    };
  } catch (error: any) {
    context.log('Add contact error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error', message: error.message },
    };
  }
}

app.http('addContact', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'customers/{id}/contact',
  handler: addContact,
});

