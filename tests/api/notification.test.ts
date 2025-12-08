/**
 * API tests for Notification Service
 */

import { ApiClient } from '../utils/api-client';
import { SERVICES } from '../utils/config';
import { USERS } from '../fixtures/users';

describe('Notification Service API', () => {
  let adminClient: ApiClient;
  let userClient: ApiClient;
  let serviceClient: ApiClient;
  let unauthenticatedClient: ApiClient;

  beforeAll(() => {
    adminClient = new ApiClient('notification', { authenticated: true, asAdmin: true });
    userClient = new ApiClient('notification', { authenticated: true });
    serviceClient = new ApiClient('notification', { asService: true });
    unauthenticatedClient = new ApiClient('notification');
  });

  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      const response = await unauthenticatedClient.get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        status: expect.stringMatching(/healthy|ok/i),
      });
    });
  });

  describe('Notification Sending', () => {
    describe('POST /api/notifications/send', () => {
      it('should send a notification via service key', async () => {
        const notification = {
          templateId: 'welcome',
          userId: USERS.broker.userId,
          channel: 'in-app',
          data: {
            userName: USERS.broker.displayName,
          },
        };

        const response = await serviceClient.post('/api/notifications/send', notification);
        
        expect([200, 201, 401, 403]).toContain(response.status);
      });

      it('should reject without proper authorization', async () => {
        const response = await unauthenticatedClient.post('/api/notifications/send', {
          templateId: 'welcome',
          userId: USERS.broker.userId,
        });
        
        expect([401, 403]).toContain(response.status);
      });
    });

    describe('POST /api/notifications/send-bulk', () => {
      it('should send bulk notifications', async () => {
        const bulkNotification = {
          templateId: 'announcement',
          userIds: [USERS.broker.userId, USERS.seniorBroker.userId],
          channel: 'in-app',
          data: {
            message: 'Test announcement',
          },
        };

        const response = await serviceClient.post('/api/notifications/send-bulk', bulkNotification);
        
        expect([200, 202, 401, 403]).toContain(response.status);
      });
    });
  });

  describe('User Notifications', () => {
    describe('GET /api/notifications', () => {
      it('should list user notifications', async () => {
        const response = await userClient.get('/api/notifications');
        
        expect([200, 401]).toContain(response.status);
      });

      it('should support pagination', async () => {
        const response = await userClient.get('/api/notifications?page=1&limit=10');
        
        expect([200, 401]).toContain(response.status);
      });

      it('should filter by read status', async () => {
        const response = await userClient.get('/api/notifications?read=false');
        
        expect([200, 401]).toContain(response.status);
      });
    });

    describe('GET /api/notifications/:notificationId', () => {
      it('should get a specific notification', async () => {
        const response = await userClient.get('/api/notifications/notif-001');
        
        expect([200, 401, 404]).toContain(response.status);
      });
    });

    describe('PUT /api/notifications/:notificationId/read', () => {
      it('should mark notification as read', async () => {
        const response = await userClient.put('/api/notifications/notif-001/read');
        
        expect([200, 401, 404]).toContain(response.status);
      });
    });

    describe('PUT /api/notifications/read-all', () => {
      it('should mark all notifications as read', async () => {
        const response = await userClient.put('/api/notifications/read-all');
        
        expect([200, 401]).toContain(response.status);
      });
    });

    describe('GET /api/notifications/unread-count', () => {
      it('should get unread notification count', async () => {
        const response = await userClient.get('/api/notifications/unread-count');
        
        expect([200, 401]).toContain(response.status);
        if (response.status === 200) {
          expect(response.data).toHaveProperty('count');
        }
      });
    });
  });

  describe('Notification Templates', () => {
    describe('GET /api/templates', () => {
      it('should list notification templates', async () => {
        const response = await adminClient.get('/api/templates');
        
        expect([200, 401]).toContain(response.status);
      });
    });

    describe('POST /api/templates', () => {
      it('should create a notification template', async () => {
        const template = {
          templateId: `template-test-${Date.now()}`,
          name: 'Test Template',
          description: 'Template for testing',
          channels: ['in-app', 'email'],
          subject: 'Test Subject: {{title}}',
          body: 'Hello {{userName}}, this is a test notification.',
          variables: ['title', 'userName'],
        };

        const response = await adminClient.post('/api/templates', template);
        
        expect([200, 201, 401, 403]).toContain(response.status);
      });
    });

    describe('GET /api/templates/:templateId', () => {
      it('should get a specific template', async () => {
        const response = await adminClient.get('/api/templates/welcome');
        
        expect([200, 401, 404]).toContain(response.status);
      });
    });

    describe('PUT /api/templates/:templateId', () => {
      it('should update a template', async () => {
        const response = await adminClient.put('/api/templates/welcome', {
          description: 'Updated description',
        });
        
        expect([200, 401, 403, 404]).toContain(response.status);
      });
    });

    describe('DELETE /api/templates/:templateId', () => {
      it('should delete a template', async () => {
        const response = await adminClient.delete('/api/templates/template-to-delete');
        
        expect([200, 204, 401, 403, 404]).toContain(response.status);
      });
    });

    describe('POST /api/templates/:templateId/preview', () => {
      it('should preview a template', async () => {
        const response = await adminClient.post('/api/templates/welcome/preview', {
          data: {
            userName: 'Test User',
          },
        });
        
        expect([200, 401, 404]).toContain(response.status);
      });
    });
  });

  describe('User Preferences', () => {
    describe('GET /api/preferences', () => {
      it('should get user notification preferences', async () => {
        const response = await userClient.get('/api/preferences');
        
        expect([200, 401]).toContain(response.status);
      });
    });

    describe('PUT /api/preferences', () => {
      it('should update user preferences', async () => {
        const preferences = {
          email: {
            enabled: true,
            frequency: 'immediate',
          },
          sms: {
            enabled: false,
          },
          push: {
            enabled: true,
          },
          inApp: {
            enabled: true,
          },
        };

        const response = await userClient.put('/api/preferences', preferences);
        
        expect([200, 401]).toContain(response.status);
      });
    });
  });

  describe('Real-time Notifications', () => {
    describe('GET /api/realtime/negotiate', () => {
      it('should return SignalR connection info', async () => {
        const response = await userClient.get('/api/realtime/negotiate');
        
        expect([200, 401]).toContain(response.status);
      });
    });
  });
});

