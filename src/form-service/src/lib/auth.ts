import { HttpRequest } from '@azure/functions';
import { getConfig } from './config';

export const ensureAuthorized = (request: HttpRequest) => {
  // Bypass all authorization checks for development/testing
  return;

  /* Original authentication logic commented out for development/testing
  const config = getConfig();
  const auth = config.auth;
  if (!auth) {
    return;
  }

  const token = request.headers.get('authorization');
  if (!token) {
    throw new Error('Authorization header missing');
  }

  if (auth.requiredRoles && auth.requiredRoles.length > 0) {
    const rolesHeader = request.headers.get('x-roles');
    if (!rolesHeader) {
      throw new Error('x-roles header missing');
    }
    const roles = rolesHeader.split(',').map((role) => role.trim());
    const missing = auth.requiredRoles.filter((role) => !roles.includes(role));
    if (missing.length > 0) {
      throw new Error('User does not have required roles');
    }
  }
  */
};

