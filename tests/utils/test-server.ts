/**
 * Test server utilities for starting and stopping Azure Functions locally
 */

import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { SERVICES, ServiceConfig, TEST_CONFIG } from './config';

const execAsync = promisify(exec);

interface ServiceProcess {
  name: string;
  process: ChildProcess;
  port: number;
}

const runningServices: Map<string, ServiceProcess> = new Map();

/**
 * Check if a service is running by hitting its health endpoint
 */
export async function isServiceHealthy(service: ServiceConfig): Promise<boolean> {
  try {
    const response = await fetch(`${service.url}${service.healthEndpoint}`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * Wait for a service to become healthy
 */
export async function waitForService(
  service: ServiceConfig,
  timeoutMs: number = TEST_CONFIG.serviceStartTimeout
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (await isServiceHealthy(service)) {
      console.log(`✓ ${service.name} is healthy`);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`Timeout waiting for ${service.name} to become healthy`);
}

/**
 * Start a single Azure Functions service
 */
export async function startService(
  serviceName: keyof typeof SERVICES
): Promise<void> {
  const service = SERVICES[serviceName];
  
  if (runningServices.has(serviceName)) {
    console.log(`${service.name} is already running`);
    return;
  }

  // Check if already running externally
  if (await isServiceHealthy(service)) {
    console.log(`${service.name} is already running externally`);
    return;
  }

  const servicePath = path.resolve(__dirname, '../../src', service.name);
  
  console.log(`Starting ${service.name} on port ${service.port}...`);
  
  const proc = spawn('func', ['start', '--port', String(service.port)], {
    cwd: servicePath,
    env: {
      ...process.env,
      FUNCTIONS_WORKER_RUNTIME: 'node',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  // Capture output for debugging
  proc.stdout?.on('data', (data: Buffer) => {
    if (process.env.DEBUG_SERVICES) {
      console.log(`[${service.name}] ${data.toString()}`);
    }
  });

  proc.stderr?.on('data', (data: Buffer) => {
    if (process.env.DEBUG_SERVICES) {
      console.error(`[${service.name}] ${data.toString()}`);
    }
  });

  proc.on('error', (error) => {
    console.error(`Error starting ${service.name}:`, error);
  });

  proc.on('exit', (code) => {
    console.log(`${service.name} exited with code ${code}`);
    runningServices.delete(serviceName);
  });

  runningServices.set(serviceName, {
    name: service.name,
    process: proc,
    port: service.port,
  });

  // Wait for the service to become healthy
  await waitForService(service);
}

/**
 * Stop a single service
 */
export async function stopService(serviceName: keyof typeof SERVICES): Promise<void> {
  const serviceProcess = runningServices.get(serviceName);
  
  if (!serviceProcess) {
    return;
  }

  console.log(`Stopping ${serviceProcess.name}...`);
  
  serviceProcess.process.kill('SIGTERM');
  
  // Wait for process to exit
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      serviceProcess.process.kill('SIGKILL');
      resolve();
    }, 5000);

    serviceProcess.process.on('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  runningServices.delete(serviceName);
  console.log(`✓ ${serviceProcess.name} stopped`);
}

/**
 * Start multiple services
 */
export async function startServices(
  serviceNames: (keyof typeof SERVICES)[]
): Promise<void> {
  console.log(`\nStarting ${serviceNames.length} services...`);
  
  // Start services in dependency order
  const orderedServices = orderServicesByDependency(serviceNames);
  
  for (const serviceName of orderedServices) {
    await startService(serviceName);
  }
  
  console.log(`\n✓ All ${serviceNames.length} services started\n`);
}

/**
 * Stop all running services
 */
export async function stopAllServices(): Promise<void> {
  console.log('\nStopping all services...');
  
  const stopPromises = Array.from(runningServices.keys()).map(
    (serviceName) => stopService(serviceName as keyof typeof SERVICES)
  );
  
  await Promise.all(stopPromises);
  
  console.log('✓ All services stopped\n');
}

/**
 * Order services by their dependencies (auth first, then authz, etc.)
 */
function orderServicesByDependency(
  serviceNames: (keyof typeof SERVICES)[]
): (keyof typeof SERVICES)[] {
  const order: (keyof typeof SERVICES)[] = [
    'authentication',
    'authorization',
    'audit',
    'staffManagement',
    'notification',
    'workflow',
    'customer',
    'lead',
    'form',
    'document',
    'quotation',
    'quotationGeneration',
    'policy',
  ];
  
  return order.filter(s => serviceNames.includes(s));
}

/**
 * Start core security services (auth, authz, audit, notification)
 */
export async function startCoreServices(): Promise<void> {
  await startServices([
    'authentication',
    'authorization',
    'audit',
    'notification',
  ]);
}

/**
 * Start all services
 */
export async function startAllServices(): Promise<void> {
  await startServices(Object.keys(SERVICES) as (keyof typeof SERVICES)[]);
}

/**
 * Kill any processes using the service ports
 */
export async function killPortProcesses(): Promise<void> {
  const ports = Object.values(SERVICES).map(s => s.port);
  
  for (const port of ports) {
    try {
      await execAsync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`);
    } catch {
      // Ignore errors - port may not be in use
    }
  }
}

// Cleanup on process exit
process.on('SIGINT', async () => {
  await stopAllServices();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopAllServices();
  process.exit(0);
});

