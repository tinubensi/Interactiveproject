/**
 * URL Helper for Frontend URL Configuration
 * Provides validation and retrieval of FRONTEND_URL environment variable
 */

/**
 * Get and validate the frontend URL from environment variables
 * 
 * @returns {string} The validated frontend URL (without trailing slash)
 * @throws {Error} If URL is invalid or not configured properly for the environment
 */
export function getFrontendUrl(): string {
  const frontendUrl = process.env.FRONTEND_URL;
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  // Check if FRONTEND_URL is set
  if (!frontendUrl || frontendUrl.trim() === '') {
    if (isProduction) {
      throw new Error(
        'FRONTEND_URL environment variable is not set. ' +
        'Please configure it in Azure Portal with your production Vercel URL.'
      );
    }
    // In development, warn and return localhost
    console.warn('[URL Helper] FRONTEND_URL not set, using localhost:3000 for development');
    return 'http://localhost:3000';
  }

  // Validate URL format
  let url: URL;
  try {
    url = new URL(frontendUrl);
  } catch (error) {
    throw new Error(
      `Invalid FRONTEND_URL format: "${frontendUrl}". ` +
      'Please provide a valid URL (e.g., https://your-app.vercel.app)'
    );
  }

  // Check for localhost in production
  const isLocalhost = url.hostname === 'localhost' || 
                      url.hostname === '127.0.0.1' || 
                      url.hostname === '0.0.0.0';

  if (isProduction && isLocalhost) {
    throw new Error(
      'localhost URLs are not allowed in production environment. ' +
      'Please set FRONTEND_URL to your production Vercel URL in Azure Portal.'
    );
  }

  // Remove trailing slash
  const cleanUrl = frontendUrl.endsWith('/') 
    ? frontendUrl.slice(0, -1) 
    : frontendUrl;

  return cleanUrl;
}
