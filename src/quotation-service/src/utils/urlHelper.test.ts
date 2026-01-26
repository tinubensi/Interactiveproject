import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { getFrontendUrl } from './urlHelper';

describe('urlHelper', () => {
  const originalEnv = process.env.FRONTEND_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  after(() => {
    // Restore original environment variables
    if (originalEnv !== undefined) {
      process.env.FRONTEND_URL = originalEnv;
    } else {
      delete process.env.FRONTEND_URL;
    }
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  describe('getFrontendUrl', () => {
    it('should return valid HTTPS URL without modification', () => {
      process.env.FRONTEND_URL = 'https://app.vercel.app';
      process.env.NODE_ENV = 'production';

      const result = getFrontendUrl();

      assert.strictEqual(result, 'https://app.vercel.app');
    });

    it('should remove trailing slash from URL', () => {
      process.env.FRONTEND_URL = 'https://app.vercel.app/';
      process.env.NODE_ENV = 'production';

      const result = getFrontendUrl();

      assert.strictEqual(result, 'https://app.vercel.app');
    });

    it('should accept valid HTTP localhost in development', () => {
      process.env.FRONTEND_URL = 'http://localhost:3000';
      process.env.NODE_ENV = 'development';

      const result = getFrontendUrl();

      assert.strictEqual(result, 'http://localhost:3000');
    });

    it('should accept valid HTTPS localhost in development', () => {
      process.env.FRONTEND_URL = 'https://localhost:3000';
      process.env.NODE_ENV = 'development';

      const result = getFrontendUrl();

      assert.strictEqual(result, 'https://localhost:3000');
    });

    it('should return localhost with warning when FRONTEND_URL not set in development', () => {
      delete process.env.FRONTEND_URL;
      process.env.NODE_ENV = 'development';

      const result = getFrontendUrl();

      assert.strictEqual(result, 'http://localhost:3000');
    });

    it('should throw error when FRONTEND_URL not set in production', () => {
      delete process.env.FRONTEND_URL;
      process.env.NODE_ENV = 'production';

      assert.throws(
        () => getFrontendUrl(),
        {
          name: 'Error',
          message: /FRONTEND_URL environment variable is not set/
        }
      );
    });

    it('should throw error for localhost URL in production', () => {
      process.env.FRONTEND_URL = 'http://localhost:3000';
      process.env.NODE_ENV = 'production';

      assert.throws(
        () => getFrontendUrl(),
        {
          name: 'Error',
          message: /localhost URLs are not allowed in production/
        }
      );
    });

    it('should throw error for 127.0.0.1 URL in production', () => {
      process.env.FRONTEND_URL = 'http://127.0.0.1:3000';
      process.env.NODE_ENV = 'production';

      assert.throws(
        () => getFrontendUrl(),
        {
          name: 'Error',
          message: /localhost URLs are not allowed in production/
        }
      );
    });

    it('should throw error for invalid URL format', () => {
      process.env.FRONTEND_URL = 'not-a-valid-url';
      process.env.NODE_ENV = 'production';

      assert.throws(
        () => getFrontendUrl(),
        {
          name: 'Error',
          message: /Invalid FRONTEND_URL format/
        }
      );
    });

    it('should throw error for empty string', () => {
      process.env.FRONTEND_URL = '';
      process.env.NODE_ENV = 'production';

      assert.throws(
        () => getFrontendUrl(),
        {
          name: 'Error',
          message: /FRONTEND_URL environment variable is not set/
        }
      );
    });

    it('should accept custom domain URLs', () => {
      process.env.FRONTEND_URL = 'https://crm.customdomain.com';
      process.env.NODE_ENV = 'production';

      const result = getFrontendUrl();

      assert.strictEqual(result, 'https://crm.customdomain.com');
    });

    it('should accept Vercel app URLs', () => {
      process.env.FRONTEND_URL = 'https://nectaria-crm-abc123.vercel.app';
      process.env.NODE_ENV = 'production';

      const result = getFrontendUrl();

      assert.strictEqual(result, 'https://nectaria-crm-abc123.vercel.app');
    });

    it('should accept Azure Static Web Apps URLs', () => {
      process.env.FRONTEND_URL = 'https://app-name.azurestaticapps.net';
      process.env.NODE_ENV = 'production';

      const result = getFrontendUrl();

      assert.strictEqual(result, 'https://app-name.azurestaticapps.net');
    });
  });
});
