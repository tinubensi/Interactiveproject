module.exports = {
  apps: [{
    name: 'emaf-pdf-service',
    script: './dist/src/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_file: './.env',
    env: {
      NODE_ENV: 'production',
      PORT: 8081
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
