/**
 * Form Service Client for EMAF
 * HTTP client for communicating with form-service
 */

import axios, { AxiosInstance } from 'axios';
import { getConfig } from '../config';

class FormServiceClient {
  private client: AxiosInstance;

  constructor() {
    const config = getConfig();
    
    this.client = axios.create({
      baseURL: config.services.formServiceUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get form template by ID
   */
  async getFormTemplate(templateId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/templates/${templateId}`);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to get form template ${templateId}:`, error.message);
      throw new Error(`Form template not found: ${templateId}`);
    }
  }

  /**
   * List form templates by insurance line
   */
  async listFormTemplates(insuranceLine?: string): Promise<any[]> {
    try {
      const params = insuranceLine ? { insuranceLine } : {};
      const response = await this.client.get('/api/templates', { params });
      return response.data.templates || response.data;
    } catch (error: any) {
      console.error('Failed to list form templates:', error.message);
      return [];
    }
  }

  /**
   * Validate form data against template
   */
  async validateFormData(templateId: string, formData: Record<string, any>): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    try {
      const template = await this.getFormTemplate(templateId);
      
      // Basic validation - check required fields
      const errors: string[] = [];
      
      template.sections?.forEach((section: any) => {
        section.questions?.forEach((question: any) => {
          if (question.validation?.required) {
            const value = formData[question.dataKey];
            if (value === undefined || value === null || value === '') {
              errors.push(`${question.label} is required`);
            }
          }
        });
      });
      
      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error: any) {
      console.error('Failed to validate form data:', error.message);
      throw error;
    }
  }
}

export const formServiceClient = new FormServiceClient();
