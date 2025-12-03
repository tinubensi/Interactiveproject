import { HttpRequest, HttpResponseInit } from '@azure/functions';
export declare const handlePreflight: (request: HttpRequest) => HttpResponseInit | null;
/**
 * Wraps an HTTP response with CORS headers
 */
export declare const withCors: (response: HttpResponseInit) => HttpResponseInit;
//# sourceMappingURL=corsHelper.d.ts.map