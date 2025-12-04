#!/usr/bin/env tsx
/**
 * Script to stop all running services
 */

import { stopAllServices, killPortProcesses } from './test-server';

async function main() {
  console.log('🛑 Stopping all Nectaria services...\n');
  
  await stopAllServices();
  await killPortProcesses();
  
  console.log('✅ All services stopped.\n');
}

main().catch((error) => {
  console.error('Failed to stop services:', error);
  process.exit(1);
});

