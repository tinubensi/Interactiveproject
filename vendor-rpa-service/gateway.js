/**
 * RPA Gateway Server
 * Routes /api/{vendor}/scrape requests to individual bot servers
 * This allows the quotation service to call a single endpoint
 */

const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Bot server port mapping
const BOT_PORTS = {
  'alsagr': 3001,
  'takaful': 3002,
  'watania': 3003,
  'sukoon': 3004,
  'gig-gulf': 3005
};

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'RPA Gateway',
    bots: Object.keys(BOT_PORTS)
  });
});

// Route vendor requests to appropriate bot server
app.post('/api/:vendor/scrape', async (req, res) => {
  const vendor = req.params.vendor.toLowerCase();
  const port = BOT_PORTS[vendor];
  
  if (!port) {
    return res.status(404).json({
      success: false,
      error: `Unknown vendor: ${vendor}. Available: ${Object.keys(BOT_PORTS).join(', ')}`
    });
  }
  
  try {
    console.log(`[Gateway] Routing ${vendor} request to port ${port}`);
    
    // Forward request to bot server
    const response = await axios.post(
      `http://localhost:${port}/scrape`,
      req.body,
      {
        timeout: 900000, // 15 minutes (bots can take up to 15 minutes for extraction)
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    console.log(`[Gateway] ${vendor} responded: ${response.data.success ? 'success' : 'failed'}`);
    res.json(response.data);
    
  } catch (error) {
    console.error(`[Gateway] Error calling ${vendor}:`, error.message);
    
    // Check if bot server is down
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: `${vendor} bot server is not running on port ${port}`
      });
    }
    
    // Check for timeout
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        success: false,
        error: `${vendor} bot timed out after 15 minutes`
      });
    }
    
    // Forward error response from bot server
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    
    // Unknown error
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 80;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 RPA Gateway listening on port ${PORT}`);
  console.log(`📡 Available bots:`);
  Object.entries(BOT_PORTS).forEach(([vendor, port]) => {
    console.log(`   - ${vendor}: http://localhost:${PORT}/api/${vendor}/scrape → http://localhost:${port}/scrape`);
  });
});
