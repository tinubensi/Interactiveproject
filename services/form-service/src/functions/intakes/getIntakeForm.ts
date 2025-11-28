import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getIntake } from '../../lib/intakeFormRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { ensureAuthorized } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const getIntakeHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    ensureAuthorized(request);
    const intakeId = request.params.intakeId;
    context.log('Fetching intake', { intakeId });
    if (!intakeId) {
      return jsonResponse(400, { error: 'intakeId is required' });
    }
    const intake = await getIntake(intakeId);
    if (!intake) {
      return jsonResponse(404, { error: 'Intake not found' });
    }
    return jsonResponse(200, intake);
  } catch (error) {
    context.error('Error fetching intake', error);
    return handleError(error);
  }
};

app.http('GetIntakeForm', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'intakes/{intakeId}',
  handler: getIntakeHandler
});

