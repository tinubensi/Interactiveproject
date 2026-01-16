module.exports = {
  apps: [
    {
      name: 'alsagr-bot',
      script: './bots/alsagr/server.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '2G',
      env: {
        PORT: 3001,
        NODE_ENV: 'production',
        COSMOS_CONNECTION_STRING: process.env.COSMOS_CONNECTION_STRING || ''
      }
    },
    {
      name: 'takaful-bot',
      script: './bots/takaful/server.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '2G',
      env: {
        PORT: 3002,
        NODE_ENV: 'production',
        COSMOS_CONNECTION_STRING: process.env.COSMOS_CONNECTION_STRING || ''
      }
    },
    {
      name: 'watania-bot',
      script: './bots/watania/server.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '2G',
      env: {
        PORT: 3003,
        NODE_ENV: 'production',
        COSMOS_CONNECTION_STRING: process.env.COSMOS_CONNECTION_STRING || ''
      }
    },
    {
      name: 'sukoon-bot',
      script: './bots/sukoon/server.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '2G',
      env: {
        PORT: 3004,
        NODE_ENV: 'production',
        COSMOS_CONNECTION_STRING: process.env.COSMOS_CONNECTION_STRING || ''
      }
    }
  ]
};
