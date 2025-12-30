import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { eventGridService } from '../../services/eventGridService';

export async function checkEventGridStatus(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const endpoint = process.env.EVENT_GRID_TOPIC_ENDPOINT || 'NOT SET';
  const keyPresent = !!process.env.EVENT_GRID_TOPIC_KEY;
  const keyLength = process.env.EVENT_GRID_TOPIC_KEY?.length || 0;

  // Try to access the service singleton
  const serviceInfo = {
    endpoint: endpoint,
    endpointPresent: !!endpoint,
    keyPresent: keyPresent,
    keyLength: keyLength,
    // @ts-ignore - accessing private property for diagnostics
    enabled: eventGridService?.enabled || false,
    // @ts-ignore
    clientExists: !!eventGridService?.client,
  };

  context.log('Event Grid Status Check:', JSON.stringify(serviceInfo, null, 2));

  // Try to publish a test event
  let testPublishResult: any = { attempted: false };
  try {
    await eventGridService.publishEvent(
      'test.diagnostic',
      '/diagnostic/test',
      { timestamp: new Date(), source: 'diagnostic-endpoint' },
      '1.0'
    );
    testPublishResult = { success: true, message: 'Test event published' };
  } catch (error: any) {
    testPublishResult = { 
      success: false, 
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3)
    };
  }

  return {
    status: 200,
    jsonBody: {
      eventGridStatus: serviceInfo,
      testPublish: testPublishResult,
      timestamp: new Date().toISOString()
    }
  };
}

app.http('checkEventGridStatus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: checkEventGridStatus,
  route: 'debug/eventgrid-status'
});
