# Dockerfile for RPA Container Jobs
# Builds a single image containing ALL vendor scripts
# Each container instance runs a specific vendor bot based on VENDOR_ID env var

FROM mcr.microsoft.com/playwright/python:v1.57.0-jammy

WORKDIR /app

# Set default environment variables
ENV PYTHONUNBUFFERED=1
ENV PW_BROWSER=chromium
ENV PW_HEADLESS=true
ENV LOG_LEVEL=INFO

# Required runtime environment variables (set by Azure Container Apps Job):
# - VENDOR_ID: Which vendor bot to run (e.g., 'watania', 'nextcare', 'daman')
# - LEAD_DATA: JSON string with lead information
# - COSMOS_CONNECTION_STRING: Cosmos DB connection string for saving plans

# Install additional fonts and libraries for better PDF text extraction
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    fontconfig \
    && fc-cache -f -v \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Python package if not already in base image
RUN pip install --no-cache-dir playwright

# Install Playwright browsers (chromium only for efficiency)
RUN python -m playwright install chromium --with-deps

# Copy ALL vendor scripts and code
COPY vendors/ ./vendors/
COPY container/ ./container/
COPY shared/ ./shared/
COPY config/ ./config/

# Create screenshots directory
RUN mkdir -p /app/screenshots

# Set Python path
ENV PYTHONPATH=/app

# Entry point: RPA executor
# Reads VENDOR_ID and LEAD_DATA from environment
# Executes RPA for the specified vendor
# Saves plans directly to Cosmos DB
CMD ["python", "/app/container/queue_consumer_continuous.py"]

