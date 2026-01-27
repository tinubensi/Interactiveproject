const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));

// 🔒 DEDUPLICATION: Track processing leads to prevent duplicates
const processingLeads = new Map(); // leadId -> timestamp
const DEDUP_WINDOW_MS = 3600000; // 60 minutes (1 hour) to block all old retries

app.post('/scrape', async (req, res) => {
  const { leadData } = req.body;
  
  if (!leadData || !leadData.id) {
    return res.status(400).json({ 
      success: false, 
      error: 'leadData with id required' 
    });
  }
  
  const leadId = leadData.id;
  const now = Date.now();
  
  // 🔒 DEDUPLICATION: Check if already processing this lead
  const lastProcessed = processingLeads.get(leadId);
  if (lastProcessed) {
    const timeSince = now - lastProcessed;
    if (timeSince < DEDUP_WINDOW_MS) {
      console.log(`[Alsagr] ⏭️ Skipping duplicate request for lead ${leadId} (processed ${Math.round(timeSince/1000)}s ago)`);
      return res.status(429).json({
        success: false,
        error: 'Lead is already being processed',
        retryAfter: Math.ceil((DEDUP_WINDOW_MS - timeSince) / 1000)
      });
    }
  }
  
  // Mark this lead as being processed
  processingLeads.set(leadId, now);
  
  // Cleanup old entries (older than 10 minutes)
  for (const [cachedLeadId, timestamp] of processingLeads.entries()) {
    if (now - timestamp > 600000) {
      processingLeads.delete(cachedLeadId);
    }
  }
  
  console.log(`[Alsagr] Processing lead ${leadId}`);
  const startTime = Date.now();
  
  try {
    // Spawn Python bot using venv
    const botPath = path.join(__dirname, '../../vendors/alsagr/cli.py');
    const venvPython = path.join(__dirname, '../../venv/bin/python3');
    const python = spawn(venvPython, [
      botPath,
      '--lead-data', JSON.stringify(leadData)
    ], {
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1'
      }
    });
    
    let output = '';
    let errorOutput = '';
    let responseCompleted = false;
    let lastOutputTime = Date.now();
    let botCompletionDetected = false;
    
    python.stdout.on('data', (data) => {
      output += data.toString();
      const line = data.toString().trim();
      console.log(`[Alsagr] ${line}`);
      lastOutputTime = Date.now();
      
      // 🔍 Detect when bot has completed successfully
      if (line.includes('Success:') && line.includes('plans in')) {
        botCompletionDetected = true;
        console.log('[Alsagr] ✅ Bot completion detected, will force cleanup in 10s...');
        
        // Give bot 10 seconds to exit cleanly, then force kill
        setTimeout(() => {
          if (!responseCompleted && python.pid) {
            console.log('[Alsagr] ⚠️ Bot did not exit cleanly, forcing kill...');
            python.kill('SIGKILL');
          }
        }, 10000);
      }
    });
    
    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`[Alsagr] Error: ${data.toString().trim()}`);
      lastOutputTime = Date.now();
    });
    
    python.on('close', (code) => {
      if (responseCompleted) return; // Already sent response
      responseCompleted = true;
      
      // 🔓 Remove lead from processing cache
      processingLeads.delete(leadId);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (code === 0) {
        try {
          // Trim whitespace and extract JSON (handle any extra output)
          const trimmedOutput = output.trim();
          // Try to find JSON array/object in output (in case there's extra text)
          let jsonStart = trimmedOutput.indexOf('[');
          if (jsonStart === -1) jsonStart = trimmedOutput.indexOf('{');
          
          if (jsonStart === -1) {
            throw new Error('No JSON array or object found in output');
          }
          
          const jsonEnd = trimmedOutput.lastIndexOf(']') + 1;
          let jsonStr;
          
          if (jsonEnd > jsonStart && jsonEnd > 0) {
            // Found JSON array
            jsonStr = trimmedOutput.substring(jsonStart, jsonEnd);
          } else {
            // Try to find JSON object
            const objEnd = trimmedOutput.lastIndexOf('}') + 1;
            if (objEnd > jsonStart && objEnd > 0) {
              jsonStr = trimmedOutput.substring(jsonStart, objEnd);
            } else {
              throw new Error('No valid JSON structure found in output');
            }
          }
          
          const plans = JSON.parse(jsonStr);
          const plansArray = Array.isArray(plans) ? plans : [plans];
          console.log(`[Alsagr] Success: ${plansArray.length} plans in ${duration}s`);
          res.json({ 
            success: true, 
            vendorId: 'vendor-alsagr', 
            plans: plansArray,
            executionTime: `${duration}s`
          });
        } catch (parseError) {
          console.error('[Alsagr] Failed to parse output:', parseError);
          console.error('[Alsagr] Output length:', output.length);
          console.error('[Alsagr] Output preview (first 1000 chars):', output.substring(0, 1000));
          console.error('[Alsagr] Output preview (last 1000 chars):', output.substring(Math.max(0, output.length - 1000)));
          res.status(500).json({ 
            success: false, 
            error: 'Failed to parse bot output',
            details: parseError.message,
            outputLength: output.length,
            outputPreview: output.substring(0, 500)
          });
        }
      } else {
        console.error(`[Alsagr] Bot failed with code ${code} after ${duration}s`);
        res.status(500).json({ 
          success: false, 
          error: `Bot execution failed with code ${code}`,
          details: errorOutput
        });
      }
    });
    
    // Timeout after 15 minutes (bot extraction can take up to 900 seconds)
    setTimeout(() => {
      if (responseCompleted) return; // Already sent response
      responseCompleted = true;
      
      // 🔓 Remove lead from processing cache
      processingLeads.delete(leadId);
      
      if (python.pid) {
        console.log('[Alsagr] ⏱️ 15-minute timeout reached, force killing bot...');
        python.kill('SIGKILL'); // Force kill immediately
      }
      res.status(408).json({ 
        success: false, 
        error: 'Bot execution timeout after 15 minutes' 
      });
    }, 900000); // 15 minutes
    
  } catch (error) {
    console.error('[Alsagr] Spawn error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    vendor: 'alsagr',
    uptime: process.uptime() 
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Alsagr bot server listening on port ${PORT}`);
});

