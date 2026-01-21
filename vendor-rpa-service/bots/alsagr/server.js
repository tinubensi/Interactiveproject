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
  
  console.log(`[Alsagr] Processing lead ${leadData.id}`);
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
    
    python.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`[Alsagr] ${data.toString().trim()}`);
    });
    
    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`[Alsagr] Error: ${data.toString().trim()}`);
    });
    
    python.on('close', (code) => {
      if (responseCompleted) return; // Already sent response
      responseCompleted = true;
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (code === 0) {
        try {
          const plans = JSON.parse(output);
          console.log(`[Alsagr] Success: ${plans.length} plans in ${duration}s`);
          res.json({ 
            success: true, 
            vendorId: 'vendor-alsagr', 
            plans,
            executionTime: `${duration}s`
          });
        } catch (parseError) {
          console.error('[Alsagr] Failed to parse output:', parseError);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to parse bot output',
            details: parseError.message
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
    
    // Timeout after 5 minutes
    setTimeout(() => {
      if (responseCompleted) return; // Already sent response
      responseCompleted = true;
      python.kill();
      res.status(408).json({ 
        success: false, 
        error: 'Bot execution timeout after 5 minutes' 
      });
    }, 300000);
    
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

