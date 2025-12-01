/**
 * Polyfills for Azure Functions Node.js v18 environment
 * This fixes the "crypto is not defined" error in Azure SDK
 */

// Polyfill crypto for Azure SDK
if (typeof global.crypto === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require('crypto');
  
  // Create a webcrypto-like interface
  (global as any).crypto = {
    randomUUID: () => nodeCrypto.randomUUID(),
    // Add other crypto methods as needed
    getRandomValues: (arr: any) => nodeCrypto.randomFillSync(arr),
    subtle: nodeCrypto.webcrypto?.subtle
  };
}

export {};


