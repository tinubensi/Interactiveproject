const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.post('/scrape', async (req, res) => {
  const { leadData } = req.body;
  
  if (!leadData || !leadData.id) {
    return res.status(400).json({ 
      success: false, 
      error: 'leadData with id required' 
    });
  }
  
  console.log(`[GIG-Gulf] Processing lead ${leadData.id}`);
  const startTime = Date.now();
  
  try {
    // Spawn Python bot
    const botPath = path.join(__dirname, '../../vendors/gig_gulf/cli.py');
    const python = spawn('python3', [
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
    
    python.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`[GIG-Gulf] ${data.toString().trim()}`);
    });
    
    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`[GIG-Gulf] Error: ${data.toString().trim()}`);
    });
    
    python.on('close', (code) => {
      if (responseCompleted) return;
      responseCompleted = true;
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (code === 0) {
        try {
          // Trim whitespace and extract JSON (handle any extra output)
          const trimmedOutput = output.trim();
          // Try to find JSON array/object in output (in case there's extra text)
          let jsonStart = trimmedOutput.indexOf('[');
          if (jsonStart === -1) jsonStart = trimmedOutput.indexOf('{');
          const jsonEnd = trimmedOutput.lastIndexOf(']') + 1;
          if (jsonEnd === 0) {
            const objEnd = trimmedOutput.lastIndexOf('}') + 1;
            if (objEnd > 0) {
              const jsonStr = trimmedOutput.substring(jsonStart, objEnd);
              const plans = JSON.parse(jsonStr);
              console.log(`[GIG-Gulf] Success: ${plans.length} plans in ${duration}s`);
              res.json({ 
                success: true, 
                vendorId: 'vendor-gig-gulf', 
                plans: Array.isArray(plans) ? plans : [plans],
                executionTime: `${duration}s`
              });
            } else {
              throw new Error('No valid JSON found in output');
            }
          } else {
            const jsonStr = trimmedOutput.substring(jsonStart, jsonEnd);
            const plans = JSON.parse(jsonStr);
          console.log(`[GIG-Gulf] Success: ${plans.length} plans in ${duration}s`);
          res.json({ 
            success: true, 
            vendorId: 'vendor-gig-gulf', 
            plans,
            executionTime: `${duration}s`
          });
          }
        } catch (parseError) {
          console.error('[GIG-Gulf] Failed to parse output:', parseError);
          console.error('[GIG-Gulf] Output length:', output.length);
          console.error('[GIG-Gulf] Output preview (first 500 chars):', output.substring(0, 500));
          res.status(500).json({ 
            success: false, 
            error: 'Failed to parse bot output',
            details: parseError.message,
            outputPreview: output.substring(0, 500)
          });
        }
      } else {
        console.error(`[GIG-Gulf] Bot failed with code ${code} after ${duration}s`);
        res.status(500).json({ 
          success: false, 
          error: `Bot execution failed with code ${code}`,
          details: errorOutput
        });
      }
    });
    
    // Timeout after 15 minutes (bot extraction can take up to 900 seconds)
    setTimeout(() => {
      if (responseCompleted) return;
      responseCompleted = true;
      if (python.pid) {
        console.log('[GIG-Gulf] ⏱️ 15-minute timeout reached, force killing bot...');
        python.kill('SIGKILL');
      }
      res.status(408).json({ 
        success: false, 
        error: 'Bot execution timeout after 15 minutes' 
      });
    }, 900000); // 15 minutes
    
  } catch (error) {
    console.error('[GIG-Gulf] Spawn error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    vendor: 'gig-gulf',
    uptime: process.uptime() 
  });
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`GIG Gulf bot server listening on port ${PORT}`);
});
