#!/usr/bin/env tsx
/**
 * Script to start all services for E2E testing
 */

import { startAllServices, startCoreServices, killPortProcesses } from './test-server';

async function main() {
  const args = process.argv.slice(2);
  const coreOnly = args.includes('--core');
  
  console.log('🚀 Starting Nectaria services for testing...\n');
  
  // Kill any existing processes on service ports
  console.log('Cleaning up existing processes...');
  await killPortProcesses();
  
  if (coreOnly) {
    console.log('Starting core services only...');
    await startCoreServices();
  } else {
    console.log('Starting all services...');
    await startAllServices();
  }
  
  console.log('\n✅ Services are ready for testing!\n');
  console.log('Press Ctrl+C to stop all services.\n');
  
  // Keep the script running
  await new Promise(() => {});
}

main().catch((error) => {
  console.error('Failed to start services:', error);
  process.exit(1);
});

