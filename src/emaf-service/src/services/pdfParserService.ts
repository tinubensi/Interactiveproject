/**
 * PDF Parser Service
 * Extracts text and structure from vendor PDF forms to suggest EMAF questions
 */

import pdfParse from 'pdf-parse';
import { PDFDocument } from 'pdf-lib';
import { FormSection, FormQuestion, DocumentRequirement, QuestionType } from '../models/emafTypes';
import { v4 as uuidv4 } from 'uuid';

interface ExtractedQuestion {
  text: string;
  suggestedType: QuestionType;
  suggestedDataKey: string;
  hasOptions?: boolean;
  options?: string[];
}

class PdfParserService {
  /**
   * Extract questions and structure from a PDF file
   */
  async extractFormStructure(pdfBuffer: Buffer): Promise<{
    sections: FormSection[];
    documentRequirements: DocumentRequirement[];
    pageCount: number;
    rawText: string;
  }> {
    try {
      // Parse PDF to get text content
      const pdfData = await pdfParse(pdfBuffer);
      const rawText = pdfData.text;
      const pageCount = pdfData.numpages;

      // Load PDF with pdf-lib to get more detailed info
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();

      // Extract questions from text
      const extractedQuestions = this.extractQuestions(rawText);

      // Group questions into sections
      const sections = this.groupQuestionsIntoSections(extractedQuestions);

      // Extract document requirements
      const documentRequirements = this.extractDocumentRequirements(rawText);

      return {
        sections,
        documentRequirements,
        pageCount: pages.length,
        rawText
      };
    } catch (error: any) {
      console.error('PDF parsing error:', error);
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
  }

  /**
   * Extract potential questions from raw text
   */
  private extractQuestions(text: string): ExtractedQuestion[] {
    const questions: ExtractedQuestion[] = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Common question indicators
    const questionPatterns = [
      /^(.+?)\s*:?\s*$/,  // Lines ending with colon or standalone
      /^(.+?)\s*\?\s*$/,  // Lines ending with question mark
      /^(\d+\.\s*.+?)$/,  // Numbered lines
    ];

    // Keywords that suggest form fields
    const fieldKeywords = [
      'name', 'email', 'phone', 'mobile', 'address', 'location', 'nationality',
      'date', 'birth', 'dob', 'gender', 'height', 'weight', 'occupation',
      'employer', 'emirates', 'id', 'passport', 'visa', 'marital', 'status'
    ];

    // Yes/No question patterns
    const yesNoPatterns = [
      /have you/i,
      /do you/i,
      /are you/i,
      /were you/i,
      /has been/i,
      /diagnosis/i,
      /treatment/i,
      /disease/i,
      /condition/i
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip very short lines or lines with only special characters
      if (line.length < 3 || /^[^a-zA-Z0-9]+$/.test(line)) continue;

      // Check if line looks like a question or field label
      const isFieldLabel = fieldKeywords.some(keyword => 
        line.toLowerCase().includes(keyword)
      );

      const isYesNoQuestion = yesNoPatterns.some(pattern => pattern.test(line));

      if (isFieldLabel || isYesNoQuestion || line.includes('?') || line.endsWith(':')) {
        const cleanText = line.replace(/[:?]+$/, '').trim();
        
        // Skip if too short after cleaning
        if (cleanText.length < 5) continue;

        // Determine suggested type
        let suggestedType: QuestionType = 'text';
        
        if (isYesNoQuestion) {
          suggestedType = 'radio';
        } else if (line.toLowerCase().includes('email')) {
          suggestedType = 'email';
        } else if (line.toLowerCase().includes('phone') || line.toLowerCase().includes('mobile')) {
          suggestedType = 'phone';
        } else if (line.toLowerCase().includes('date') || line.toLowerCase().includes('birth') || line.toLowerCase().includes('dob')) {
          suggestedType = 'date';
        } else if (line.toLowerCase().includes('height') || line.toLowerCase().includes('weight') || line.toLowerCase().includes('age')) {
          suggestedType = 'number';
        } else if (line.toLowerCase().includes('gender')) {
          suggestedType = 'radio';
        } else if (line.toLowerCase().includes('status') && line.toLowerCase().includes('marital')) {
          suggestedType = 'dropdown';
        }

        // Generate data key
        const dataKey = this.generateDataKey(cleanText);

        // Check if it's a yes/no question
        const options = isYesNoQuestion ? ['yes', 'no'] : undefined;

        questions.push({
          text: cleanText,
          suggestedType,
          suggestedDataKey: dataKey,
          hasOptions: isYesNoQuestion,
          options
        });
      }
    }

    return questions;
  }

  /**
   * Group extracted questions into logical sections
   */
  private groupQuestionsIntoSections(extractedQuestions: ExtractedQuestion[]): FormSection[] {
    const sections: FormSection[] = [];

    // Common section keywords for grouping
    const sectionKeywords = {
      'Policy Holder Information': ['policy holder', 'applicant', 'personal information'],
      'Insured Members': ['insured member', 'dependent', 'spouse', 'family'],
      'Previous Insurance': ['previous insurance', 'insurance history'],
      'Medical History': ['medical', 'health', 'disease', 'diagnosis', 'treatment', 'condition'],
      'Maternity': ['maternity', 'pregnancy', 'pregnant'],
      'Declaration': ['declaration', 'acknowledge', 'agree', 'authorize']
    };

    // Create a default section
    let currentSection: FormSection = {
      id: uuidv4(),
      title: 'General Information',
      order: 1,
      questions: []
    };

    let sectionOrder = 1;

    extractedQuestions.forEach((eq, index) => {
      // Check if question text indicates a new section
      let matchedSection: string | null = null;
      for (const [sectionName, keywords] of Object.entries(sectionKeywords)) {
        if (keywords.some(keyword => eq.text.toLowerCase().includes(keyword))) {
          matchedSection = sectionName;
          break;
        }
      }

      // If we found a section match and it's different from current, create new section
      if (matchedSection && matchedSection !== currentSection.title) {
        if (currentSection.questions.length > 0) {
          sections.push(currentSection);
        }
        sectionOrder++;
        currentSection = {
          id: uuidv4(),
          title: matchedSection,
          order: sectionOrder,
          questions: []
        };
      }

      // Add question to current section
      const formQuestion: FormQuestion = {
        id: uuidv4(),
        label: eq.text,
        dataKey: eq.suggestedDataKey,
        type: eq.suggestedType,
        order: currentSection.questions.length + 1,
        placeholder: this.generatePlaceholder(eq.suggestedType),
        options: eq.hasOptions && eq.options ? 
          eq.options.map(opt => ({ label: opt.charAt(0).toUpperCase() + opt.slice(1), value: opt })) : 
          undefined,
        validation: eq.suggestedType === 'email' || eq.suggestedType === 'phone' ? { required: true } : undefined
      };

      currentSection.questions.push(formQuestion);
    });

    // Add last section
    if (currentSection.questions.length > 0) {
      sections.push(currentSection);
    }

    return sections.length > 0 ? sections : [{
      id: uuidv4(),
      title: 'Extracted Questions',
      order: 1,
      questions: extractedQuestions.slice(0, 20).map((eq, idx) => ({
        id: uuidv4(),
        label: eq.text,
        dataKey: eq.suggestedDataKey,
        type: eq.suggestedType,
        order: idx + 1,
        placeholder: this.generatePlaceholder(eq.suggestedType),
        options: eq.hasOptions && eq.options ? 
          eq.options.map(opt => ({ label: opt.charAt(0).toUpperCase() + opt.slice(1), value: opt })) : 
          undefined
      }))
    }];
  }

  /**
   * Extract document requirements from text
   */
  private extractDocumentRequirements(text: string): DocumentRequirement[] {
    const requirements: DocumentRequirement[] = [];
    const lowercaseText = text.toLowerCase();

    // Common document types
    const documentKeywords = [
      { type: 'passport', keywords: ['passport', 'travel document'], required: true },
      { type: 'emirates_id', keywords: ['emirates id', 'eid', 'national id'], required: true },
      { type: 'visa', keywords: ['visa', 'residence permit'], required: true },
      { type: 'medical_reports', keywords: ['medical report', 'medical record', 'health record'], required: false },
      { type: 'previous_policy', keywords: ['previous policy', 'insurance policy', 'claim history'], required: false },
    ];

    documentKeywords.forEach(doc => {
      const found = doc.keywords.some(keyword => lowercaseText.includes(keyword));
      if (found) {
        requirements.push({
          id: uuidv4(),
          documentType: doc.type,
          label: this.formatDocumentLabel(doc.type),
          description: `Please upload a clear copy of your ${this.formatDocumentLabel(doc.type).toLowerCase()}`,
          required: doc.required,
          acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
          maxSizeInMB: 5
        });
      }
    });

    return requirements;
  }

  /**
   * Generate a data key from question text
   */
  private generateDataKey(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 50);
  }

  /**
   * Generate placeholder text based on question type
   */
  private generatePlaceholder(type: QuestionType): string {
    const placeholders: Record<QuestionType, string> = {
      text: 'Enter your answer',
      number: 'Enter a number',
      currency: 'Enter amount',
      date: 'DD/MM/YYYY',
      dropdown: 'Select an option',
      radio: 'Select one',
      checkbox: 'Select all that apply',
      email: 'example@email.com',
      phone: '+971-xx-xxx-xxxx'
    };
    return placeholders[type] || 'Enter your answer';
  }

  /**
   * Format document type label
   */
  private formatDocumentLabel(docType: string): string {
    return docType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get PDF metadata
   */
  async getPdfMetadata(pdfBuffer: Buffer): Promise<{
    pageCount: number;
    title?: string;
    author?: string;
  }> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    
    return {
      pageCount: pages.length,
      title: pdfDoc.getTitle() || undefined,
      author: pdfDoc.getAuthor() || undefined
    };
  }
}

export const pdfParserService = new PdfParserService();
