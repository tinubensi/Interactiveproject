# Use Azure Functions Node.js 18 base image
FROM mcr.microsoft.com/azure-functions/node:4-node18

# Install Playwright dependencies and fonts
RUN apt-get update && apt-get install -y \
    # Chromium dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxshmfence1 \
    # Fonts (includes Arabic support)
    fonts-liberation \
    fonts-noto-core \
    fonts-noto-ui-core \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /home/site/wwwroot

# Copy package files
COPY package*.json ./

# Copy application code first (needed for build)
COPY . .

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Build TypeScript
RUN npm run build

# Install Playwright browsers (Chromium only for smaller image)
RUN npx playwright install chromium --with-deps

# Clean up devDependencies after build to reduce image size
RUN npm prune --production

# Set environment variables  
ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true \
    PLAYWRIGHT_BROWSERS_PATH=/home/.cache/ms-playwright

# Expose port (not strictly necessary for Azure Functions, but good practice)
EXPOSE 80

# The base image already has the CMD to start Azure Functions
