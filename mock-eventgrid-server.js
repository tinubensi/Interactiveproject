#!/usr/bin/env node

/**
 * Mock Event Grid Server for Local Development
 * 
 * This server simulates Azure Event Grid locally, allowing services to publish events
 * without needing an actual Azure Event Grid resource.
 * 
 * Features:
 * - Listens on port 4000 (configurable via PORT env var)
 * - Accepts Event Grid events via POST
 * - Logs all events with pretty formatting
 * - Returns proper responses
 * - Validates Event Grid event schema
 */

const http = require('http');

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

// ANSI color codes for better logging
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

// Event counters
const eventStats = {
  total: 0,
  byType: {},
  bySubject: {},
};

// Log with timestamp
function log(message, color = colors.reset) {
  const timestamp = new Date().toISOString();
  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${color}${message}${colors.reset}`);
}

// Format event data for display
function formatEventData(data) {
  try {
    return JSON.stringify(data, null, 2)
      .split('\n')
      .map(line => '    ' + line)
      .join('\n');
  } catch {
    return '    ' + String(data);
  }
}

// Validate Event Grid event
function validateEvent(event) {
  const required = ['id', 'eventType', 'subject', 'data', 'eventTime', 'dataVersion'];
  const missing = required.filter(field => !event[field]);
  return missing.length === 0 ? null : missing;
}

// Handle incoming HTTP requests
const server = http.createServer((req, res) => {
  const startTime = Date.now();

  // Set CORS headers for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, aeg-sas-key, aeg-sas-token');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed. Only POST is supported.' }));
    return;
  }

  // Collect request body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      // Parse events
      const events = JSON.parse(body);
      
      if (!Array.isArray(events)) {
        throw new Error('Request body must be an array of events');
      }

      // Process each event
      events.forEach((event, index) => {
        // Validate event
        const missingFields = validateEvent(event);
        if (missingFields) {
          log(`⚠️  Event ${index + 1} missing required fields: ${missingFields.join(', ')}`, colors.yellow);
        }

        // Update stats
        eventStats.total++;
        eventStats.byType[event.eventType] = (eventStats.byType[event.eventType] || 0) + 1;
        eventStats.bySubject[event.subject] = (eventStats.bySubject[event.subject] || 0) + 1;

        // Log event
        console.log('\n' + '='.repeat(80));
        log(`📨 Event Received #${eventStats.total}`, colors.bright + colors.green);
        console.log('='.repeat(80));
        log(`  Event Type: ${colors.cyan}${event.eventType}${colors.reset}`, colors.reset);
        log(`  Subject:    ${colors.blue}${event.subject}${colors.reset}`, colors.reset);
        log(`  Event ID:   ${colors.dim}${event.id}${colors.reset}`, colors.reset);
        log(`  Event Time: ${colors.dim}${event.eventTime}${colors.reset}`, colors.reset);
        log(`  Version:    ${colors.dim}${event.dataVersion}${colors.reset}`, colors.reset);
        
        if (event.topic) {
          log(`  Topic:      ${colors.dim}${event.topic}${colors.reset}`, colors.reset);
        }
        
        console.log(`\n${colors.bright}  Event Data:${colors.reset}`);
        console.log(formatEventData(event.data));
        console.log('='.repeat(80) + '\n');
      });

      const duration = Date.now() - startTime;
      log(`✅ Processed ${events.length} event(s) in ${duration}ms`, colors.green);

      // Return success response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        eventsReceived: events.length,
        message: 'Events published successfully'
      }));

    } catch (error) {
      log(`❌ Error processing request: ${error.message}`, colors.red);
      console.error(error);
      
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: error.message,
        success: false
      }));
    }
  });

  req.on('error', (error) => {
    log(`❌ Request error: ${error.message}`, colors.red);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  });
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    log(`❌ Port ${PORT} is already in use. Please stop the other process or use a different port.`, colors.red);
  } else {
    log(`❌ Server error: ${error.message}`, colors.red);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n' + '='.repeat(80));
  log('🛑 Shutting down Mock Event Grid Server...', colors.yellow);
  console.log('='.repeat(80));
  log(`📊 Total Events Received: ${eventStats.total}`, colors.bright);
  
  if (Object.keys(eventStats.byType).length > 0) {
    console.log(`\n${colors.bright}Events by Type:${colors.reset}`);
    Object.entries(eventStats.byType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${colors.cyan}${type}${colors.reset}: ${count}`);
      });
  }
  
  console.log('='.repeat(80) + '\n');
  
  server.close(() => {
    log('✅ Server closed', colors.green);
    process.exit(0);
  });
});

// Start server
server.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(80));
  log('🚀 Mock Event Grid Server Started', colors.bright + colors.green);
  console.log('='.repeat(80));
  log(`📍 Listening on: ${colors.cyan}http://${HOST}:${PORT}${colors.reset}`, colors.reset);
  log(`🔧 Mode: ${colors.yellow}Development${colors.reset}`, colors.reset);
  log(`📝 Logging: ${colors.green}Enabled${colors.reset}`, colors.reset);
  console.log('='.repeat(80));
  log('💡 Ready to receive Event Grid events...', colors.dim);
  log('💡 Press Ctrl+C to stop\n', colors.dim);
});


