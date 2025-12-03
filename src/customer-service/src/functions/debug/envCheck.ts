import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export async function envCheck(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const envVars = {
    COSMOS_DB_ENDPOINT: process.env.COSMOS_DB_ENDPOINT || 'NOT SET',
    COSMOS_DB_KEY: process.env.COSMOS_DB_KEY ? 'SET (length: ' + process.env.COSMOS_DB_KEY.length + ')' : 'NOT SET',
    COSMOS_DB_DATABASE: process.env.COSMOS_DB_DATABASE || 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'NOT SET',
    FUNCTIONS_WORKER_RUNTIME: process.env.FUNCTIONS_WORKER_RUNTIME || 'NOT SET',
  };

  context.log('Environment variables:', envVars);

  return {
    status: 200,
    jsonBody: {
      message: 'Environment variables check',
      environment: envVars,
      allEnvKeys: Object.keys(process.env).filter(key => key.includes('COSMOS') || key.includes('FUNCTIONS')),
    },
  };
}

app.http('envCheck', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'debug/env',
  handler: envCheck,
});

