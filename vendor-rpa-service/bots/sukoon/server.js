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
  
  console.log(`[Sukoon] Processing lead ${leadData.id}`);
  const startTime = Date.now();
  
  try {
    // Spawn Python bot
    const botPath = path.join(__dirname, '../../vendors/sukoon/cli.py');
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
    
    python.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`[Sukoon] ${data.toString().trim()}`);
    });
    
    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`[Sukoon] Error: ${data.toString().trim()}`);
    });
    
    python.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (code === 0) {
        try {
          const plans = JSON.parse(output);
          console.log(`[Sukoon] Success: ${plans.length} plans in ${duration}s`);
          res.json({ 
            success: true, 
            vendorId: 'vendor-sukoon', 
            plans,
            executionTime: `${duration}s`
          });
        } catch (parseError) {
          console.error('[Sukoon] Failed to parse output:', parseError);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to parse bot output',
            details: parseError.message
          });
        }
      } else {
        console.error(`[Sukoon] Bot failed with code ${code} after ${duration}s`);
        res.status(500).json({ 
          success: false, 
          error: `Bot execution failed with code ${code}`,
          details: errorOutput
        });
      }
    });
    
    // Timeout after 5 minutes
    setTimeout(() => {
      python.kill();
      res.status(408).json({ 
        success: false, 
        error: 'Bot execution timeout after 5 minutes' 
      });
    }, 300000);
    
  } catch (error) {
    console.error('[Sukoon] Spawn error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    vendor: 'sukoon',
    uptime: process.uptime() 
  });
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`Sukoon bot server listening on port ${PORT}`);
});
