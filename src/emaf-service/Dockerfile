# Use Azure Functions Node.js 18 base image
FROM mcr.microsoft.com/azure-functions/node:4-node18

# Install system dependencies for Playwright and Arabic fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core Chromium dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxshmfence1 \
    libcairo2 \
    libglib2.0-0 \
    libgtk-3-0 \
    libdbus-1-3 \
    libx11-6 \
    libxcb1 \
    libxext6 \
    # Additional dependencies for headless mode
    libgdk-pixbuf2.0-0 \
    libpango-1.0-0 \
    libharfbuzz0b \
    libatspi2.0-0 \
    # Fonts with Arabic support
    fonts-liberation \
    fonts-noto-core \
    fonts-noto-ui-core \
    fonts-noto-cjk \
    fonts-freefont-ttf \
    # Utilities
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /home/site/wwwroot

# Copy package files first for better caching
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
# Don't run postinstall yet (we'll install browsers separately)
RUN npm ci --ignore-scripts

# Copy source code and templates
COPY . .

# Build TypeScript project
RUN npm run build

# Install Playwright browsers AFTER building
# This ensures the built code is available if needed
# Use --with-deps to install any missing system dependencies
RUN npx playwright install chromium --with-deps

# Verify browser installation
RUN npx playwright install-deps chromium || true

# Create and set permissions for browser cache directory
RUN mkdir -p /home/.cache/ms-playwright && \
    chmod -R 777 /home/.cache/ms-playwright

# Clean up devDependencies to reduce image size
# Keep playwright in production dependencies for runtime
RUN npm prune --production

# Set environment variables
ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true \
    PLAYWRIGHT_BROWSERS_PATH=/home/.cache/ms-playwright \
    NODE_ENV=production \
    # Playwright headless mode settings
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost/api/health || exit 1

# The base image already has the CMD to start Azure Functions
