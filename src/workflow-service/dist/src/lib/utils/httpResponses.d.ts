import { HttpResponseInit } from '@azure/functions';
export declare const jsonResponse: (status: number, body: unknown) => HttpResponseInit;
export declare const successResponse: (body: unknown) => HttpResponseInit;
export declare const createdResponse: (body: unknown) => HttpResponseInit;
export declare const noContentResponse: () => HttpResponseInit;
export declare const badRequestResponse: (message: string, errors?: {
    path: string;
    message: string;
}[] | undefined) => HttpResponseInit;
export declare const unauthorizedResponse: (message?: string) => HttpResponseInit;
export declare const forbiddenResponse: (message?: string) => HttpResponseInit;
export declare const notFoundResponse: (resource?: string) => HttpResponseInit;
export declare const conflictResponse: (message: string) => HttpResponseInit;
export declare const internalErrorResponse: (message?: string) => HttpResponseInit;
export declare const handleError: (error: unknown) => HttpResponseInit;
export declare const preflightResponse: () => HttpResponseInit;
//# sourceMappingURL=httpResponses.d.ts.map