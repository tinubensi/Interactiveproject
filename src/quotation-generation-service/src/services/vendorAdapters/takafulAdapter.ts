/**
 * Takaful Emarat API Adapter
 * Implements the multi-step Takaful API workflow with support for multiple members
 */

import { BaseVendorAdapter, VendorApiConfig, VendorApiResult } from './baseVendorAdapter';
import { Plan } from '../../models/plan';

interface TakafulAuthResponse {
  partnerId: number;
  accessToken: string;
}

interface TakafulQuotationResponse {
  quotation_no: string;
}

interface TakafulMemberResponse {
  memberSno: number;
  quotation_no: string;
}

interface TakafulProduct {
  im_prod_sno: number;
  im_prod_desc: string;
  medical_network: string;
  dental_benefit: string;
  prescribed_drugs_medicines: string;
  optical_benefit: string;
  physiotherapy: string;
  territorial_scope_of_coverage: string;
  worldwide_coverage: string;
  ip_op: string;
  diagnostics: string;
  deductible_per_consultation: string;
  maternity: string;
  premium: number;
  TPAName: string;
  ageband_sno: number;
  consultation_type: number;
  diagnostic: string;
  consultation: string;
}

interface ProductWithMember extends TakafulProduct {
  memberSno: number;
}

export class TakafulAdapter extends BaseVendorAdapter {
  private accessToken: string | null = null;
  private partnerId: number | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: VendorApiConfig) {
    super('vendor-takaful', 'Takaful Emarat', config);
  }

  /**
   * Main orchestration method - coordinates all API steps
   */
  async fetchPlans(leadData: any): Promise<VendorApiResult> {
    const startTime = Date.now();

    try {
      console.log(`[Takaful] Starting plan fetch for lead ${leadData.leadId}`);

      // Step 1: Authenticate
      await this.ensureAuthenticated();

      // Step 2: Transform lead data
      const transformedData = this.transformLead(leadData);

      // Step 3: Create quotation
      const quotationNo = await this.createQuotation(transformedData.quotation);
      console.log(`[Takaful] Created quotation: ${quotationNo}`);

      // Step 4: Create primary member
      const primaryMemberSno = await this.createPrimaryMember(
        quotationNo,
        transformedData.member
      );
      console.log(`[Takaful] Created primary member: ${primaryMemberSno}`);

      // Step 5: Create additional members if any
      const dependentMemberSnos: number[] = [];
      if (transformedData.additionalMembers && transformedData.additionalMembers.length > 0) {
        console.log(
          `[Takaful] Creating ${transformedData.additionalMembers.length} additional member(s)...`
        );
        const dependentSnos = await this.createAdditionalMembers(
          quotationNo,
          transformedData.additionalMembers
        );
        dependentMemberSnos.push(...dependentSnos);
        console.log(`[Takaful] Created ${dependentSnos.length} dependent member(s)`);
      }

      // Step 6: Fetch products for all members
      const allMemberSnos = [primaryMemberSno, ...dependentMemberSnos];
      const allProducts: ProductWithMember[] = [];

      for (const memberSno of allMemberSnos) {
        const products = await this.getProducts(quotationNo, memberSno, transformedData.tpa);
        allProducts.push(...products.map((p) => ({ ...p, memberSno })));
      }

      console.log(
        `[Takaful] Fetched ${allProducts.length} total products across ${allMemberSnos.length} member(s)`
      );

      // Step 7: Aggregate plans by plan code
      const aggregatedPlans = this.aggregatePlansByCode(allProducts);
      console.log(`[Takaful] Aggregated into ${aggregatedPlans.length} unique plan(s)`);

      // Step 8: Normalize to StandardPlan format
      const plans = this.normalizePlans(aggregatedPlans, leadData.leadId);

      const executionTime = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

      return {
        vendorId: this.vendorId,
        plans,
        success: true,
        executionTime,
        metadata: {
          quotationNo,
          memberSnos: allMemberSnos,
          memberCount: allMemberSnos.length,
          productsCount: allProducts.length,
        },
      };
    } catch (error: any) {
      const executionTime = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
      console.error(`[Takaful] Error:`, error);

      return {
        vendorId: this.vendorId,
        plans: [],
        success: false,
        error: this.handleError(error),
        executionTime,
      };
    }
  }

  /**
   * Step 1: Authentication
   */
  protected async authenticate(): Promise<string> {
    console.log(`[Takaful] Authenticating...`);

    const response = await this.makeRequest(
      `${this.config.baseUrl}/v1/api/authorize/Authorize`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey!,
        },
        body: JSON.stringify({
          username: this.config.credentials!.username,
          password: this.config.credentials!.password,
          secretKey: this.config.credentials!.secretKey,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Authentication failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as { data: TakafulAuthResponse };
    const authData: TakafulAuthResponse = result.data;

    this.accessToken = authData.accessToken;
    this.partnerId = authData.partnerId;

    // Set token expiry (assume 1 hour for now, could parse JWT)
    this.tokenExpiry = new Date(Date.now() + 3600000);

    console.log(`[Takaful] Authenticated successfully. Partner ID: ${this.partnerId}`);

    return this.accessToken;
  }

  /**
   * Ensure we have a valid token (with caching)
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || this.isTokenExpired()) {
      await this.authenticate();
    }
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) return true;
    return new Date() >= this.tokenExpiry;
  }

  /**
   * Step 2: Create Quotation
   */
  private async createQuotation(quotationPayload: any): Promise<string> {
    const response = await this.makeRequest(
      `${this.config.baseUrl}/v1/api/Quotation/CreateQuotation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey!,
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(quotationPayload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CreateQuotation failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as { data: TakafulQuotationResponse };
    const data: TakafulQuotationResponse = result.data;
    return data.quotation_no;
  }

  /**
   * Step 3: Create Primary Member
   */
  private async createPrimaryMember(quotationNo: string, memberPayload: any): Promise<number> {
    const payload = [
      {
        ...memberPayload,
        quotation_no: quotationNo,
      },
    ];

    console.log(`[Takaful] CreatePrimaryMember payload:`, JSON.stringify(payload, null, 2));

    const response = await this.makeRequest(
      `${this.config.baseUrl}/v1/api/Member/CreatePrimaryMember`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey!,
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[Takaful] CreatePrimaryMember error response:`, errorText);
      throw new Error(`CreatePrimaryMember failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as { data: TakafulMemberResponse[] };
    console.log(`[Takaful] CreatePrimaryMember response:`, JSON.stringify(result));
    
    if (!result.data || result.data.length === 0) {
      throw new Error(`CreatePrimaryMember returned no data: ${JSON.stringify(result)}`);
    }
    
    const memberData: TakafulMemberResponse = result.data[0];
    return memberData.memberSno;
  }

  /**
   * Step 4: Create Additional Members
   */
  private async createAdditionalMembers(
    quotationNo: string,
    membersPayload: any[]
  ): Promise<number[]> {
    if (!membersPayload || membersPayload.length === 0) {
      return [];
    }

    const response = await this.makeRequest(
      `${this.config.baseUrl}/v1/api/Member/CreateMembers?quotation_no=${quotationNo}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey!,
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(membersPayload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CreateMembers failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as { data: TakafulMemberResponse[] };
    const membersData: TakafulMemberResponse[] = result.data;
    return membersData.map((m) => m.memberSno);
  }

  /**
   * Step 5: Get Products for a Member
   */
  private async getProducts(
    quotationNo: string,
    memberSno: number,
    tpaSno: number
  ): Promise<TakafulProduct[]> {
    const url = new URL(`${this.config.baseUrl}/v1/api/Product/GetAllProducts`);
    url.searchParams.append('tpa_sno', tpaSno.toString());
    url.searchParams.append('member_sno', memberSno.toString());
    url.searchParams.append('QuotationNumber', quotationNo);

    const response = await this.makeRequest(
      url.toString(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey!,
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
      60000 // 60 second timeout for product fetching
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GetAllProducts failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return (result as { data: any[] }).data || [];
  }

  /**
   * Step 6: Aggregate Plans by Plan Code
   * Combines products from multiple members into unique plans with total premiums
   */
  private aggregatePlansByCode(products: ProductWithMember[]): any[] {
    const planMap = new Map();

    for (const product of products) {
      const key = product.im_prod_sno;

      if (!planMap.has(key)) {
        planMap.set(key, {
          product: product,
          totalPremium: 0,
          memberPremiums: [],
        });
      }

      const plan = planMap.get(key);
      plan.totalPremium += product.premium;
      plan.memberPremiums.push({
        memberSno: product.memberSno,
        premium: product.premium,
      });
    }

    return Array.from(planMap.values());
  }

  /**
   * Transform lead data to Takaful-specific format
   */
  protected transformLead(leadData: any): any {
    const lobData = leadData.lobData || {};

    // Map gender: Male -> 1, Female -> 2
    const genderMap: Record<string, number> = { Male: 1, Female: 2 };
    const gender = genderMap[lobData.gender || leadData.gender || 'Male'] || 1;

    // Map emirate
    const emirateMap: Record<string, number> = {
      Dubai: 1,
      'Abu Dhabi': 2,
      Ajman: 3,
      Fujairah: 4,
      'Ras Al Khaimah': 5,
      Sharjah: 6,
      'Umm Al Quwain': 7,
    };
    const emirateSno = emirateMap[leadData.emirate || 'Dubai'] || 1;

    // Map salary
    const salaryMap: Record<string, number> = {
      'Less than 4000': 1,
      '4000-12000': 2,
      'Above 12000': 3,
      'No salary': 4,
    };
    const salary = salaryMap[lobData.salaryRange || '4000-12000'] || 2;

    // Default TPA (E-Care)
    const tpa = 5;

    // Quotation payload
    const quotation = {
      sponsorEmployerName: lobData.employerName || 'Self Employed',
      sponsorMobile: this.extractPhoneNumber(leadData.phone),
      sponsorEmail: leadData.email || 'customer@example.com',
      sponsorGender: gender,
      sponsorDateOfBirth: this.formatDate(lobData.dateOfBirth || leadData.dob || '1990-01-01'),
      sponsorUidNumber: lobData.uidNumber || '123456789',
      sponsorEidNumber: lobData.emiratesId || '784-1234-1234567-1',
      sponsorPPNo: lobData.passportNumber || 'A12345678',
      tpa: tpa,
      salary: salary,
      entity_type_sno: 1, // Individual
      cross_reference_number: leadData.leadId,
    };

    // Primary member payload
    const member = {
      noActivePolicy: true,
      sponsorName: `${leadData.firstName || 'Guest'} ${leadData.lastName || 'User'}`,
      emirateSno: emirateSno,
      firstName: leadData.firstName || 'Guest',
      secondName: leadData.firstName || 'Guest',
      familyName: leadData.lastName || 'User',
      memberHeight: parseInt(lobData.height) || 170,
      memberWeight: parseInt(lobData.weight) || 70,
      relationSno: '1', // Self
      passportNumber: lobData.passportNumber || 'A12345678',
      emiratesIdNumber: lobData.emiratesId || '784-1234-1234567-1',
      uidNo: lobData.uidNumber || '123456789',
      gender: gender,
      maritalStatus: '1', // Single
      email_: leadData.email || 'customer@example.com',
      contactNo: this.extractPhoneNumber(leadData.phone),
      nationalitySno: lobData.nationalitySno || '1',
      memberType: '1', // Adult
      visaFileNo: lobData.visaFileNo || '123456',
      residentLocation: '1',
      commissionBased: '0',
      salary: salary,
      basmahDeclaration: emirateSno === 1, // true for Dubai
      dateOfBirth: this.formatDateTime(lobData.dateOfBirth || leadData.dob || '1990-01-01'),
      policyStartByDate: this.formatDateTime(this.getNextWeekDate()),
      visaType: 1,
      sub_visa_type: 1,
    };

    // Additional members (dependents)
    const additionalMembers = this.transformAdditionalMembers(
      lobData.members || lobData.dependents || [],
      emirateSno,
      salary
    );

    return {
      quotation,
      member,
      additionalMembers,
      tpa,
    };
  }

  /**
   * Transform additional members (dependents)
   */
  private transformAdditionalMembers(
    members: any[],
    emirateSno: number,
    salary: number
  ): any[] {
    if (!members || members.length === 0) return [];

    const relationshipMap: Record<string, string> = {
      spouse: '2',
      child: '3',
      parent: '4',
      sibling: '5',
    };

    const genderMap: Record<string, number> = { Male: 1, Female: 2, male: 1, female: 2 };

    return members.map((member: any) => {
      const age = member.dateOfBirth ? this.calculateAge(member.dateOfBirth) : 25;
      const memberType = age < 18 ? '2' : '1'; // Child or Adult

      return {
        noActivePolicy: true,
        sponsorName: `${member.firstName || 'Member'} ${member.lastName || 'User'}`,
        emirateSno: emirateSno,
        firstName: member.firstName || 'Member',
        secondName: member.firstName || 'Member',
        familyName: member.lastName || 'User',
        memberHeight: parseInt(member.height) || (age < 18 ? 140 : 170),
        memberWeight: parseInt(member.weight) || (age < 18 ? 40 : 70),
        relationSno: relationshipMap[member.relationship?.toLowerCase()] || '3', // Default to child
        passportNumber: member.passportNumber || 'A12345678',
        emiratesIdNumber: member.emiratesId || '784-1234-1234567-1',
        uidNo: member.uidNumber || '123456789',
        gender: genderMap[member.gender] || 1,
        maritalStatus: '1', // Single
        email_: member.email || 'dependent@example.com',
        contactNo: this.extractPhoneNumber(member.phone) || '0501234567',
        nationalitySno: member.nationalitySno || '1',
        memberType: memberType,
        visaFileNo: member.visaFileNo || '123456',
        residentLocation: '1',
        commissionBased: '0',
        salary: memberType === '2' ? 4 : salary, // No salary for children
        basmahDeclaration: emirateSno === 1,
        dateOfBirth: this.formatDateTime(member.dateOfBirth || '2000-01-01'),
        policyStartByDate: this.formatDateTime(this.getNextWeekDate()),
        visaType: 1,
        sub_visa_type: 1,
      };
    });
  }

  /**
   * Normalize aggregated plans to StandardPlan format
   */
  protected normalizePlans(aggregatedPlans: any[], leadId: string): Plan[] {
    return aggregatedPlans.map((aggregated) => {
      const product = aggregated.product;

      return {
        id: `${leadId}_${this.vendorId}_${product.im_prod_sno}`,
        leadId: leadId,
        vendorId: this.vendorId,
        vendorName: this.vendorName,
        vendorCode: 'TKF',

        // Plan details
        planName: product.im_prod_desc,
        planCode: product.im_prod_sno.toString(),
        planType: 'Individual Medical',

        // Pricing (aggregated across all members)
        annualPremium: aggregated.totalPremium,
        monthlyPremium: Math.round((aggregated.totalPremium / 12) * 100) / 100,
        currency: 'AED',

        // Coverage
        annualLimit: this.extractCoverageAmount(product.territorial_scope_of_coverage),

        // Sub-limits
        dentalLimit: this.extractLimit(product.dental_benefit),
        opticalLimit: this.extractLimit(product.optical_benefit),
        pharmacyLimit: this.extractLimit(product.prescribed_drugs_medicines),

        // Cost sharing
        deductible: 0,
        coInsurance: this.extractCoInsurance(product.prescribed_drugs_medicines),

        // Cost sharing object (v2)
        costSharing: {
          deductible: 0,
          deductibleMetric: 'AED',
          coInsurance: this.extractCoInsurance(product.prescribed_drugs_medicines),
          coInsuranceMetric: 'percentage',
          copays: {
            consultation: product.consultation || '0%',
            diagnostic: product.diagnostic || '0%',
            deductiblePerConsultation: product.deductible_per_consultation,
          },
        },

        // Waiting period
        waitingPeriod: 30,
        waitingPeriodMetric: 'days',

        // Network
        network: {
          tpa: product.TPAName,
          networkName: product.medical_network,
        },

        // Benefits
        benefits: this.parseBenefits(product),
        
        // Exclusions
        exclusions: [
          'Pre-existing conditions subject to policy terms',
          'Cosmetic procedures',
          'Experimental treatments'
        ],

        // Metadata
        lineOfBusiness: 'medical',
        isAvailable: true,
        isSelected: false,
        isRecommended: false,
        fetchRequestId: '',
        fetchedAt: new Date(),
        source: 'api',

        // LOB specific data with member breakdown
        lobSpecificData: {
          networkProviders: product.medical_network,
          areaOfCover: product.territorial_scope_of_coverage,
          copayTestMedicine: product.prescribed_drugs_medicines,
          copayConsultation: product.consultation || '0%',
          memberCount: aggregated.memberPremiums.length,
          premiumItems: aggregated.memberPremiums,
        },

        // Raw data with member breakdown
        rawPlanData: {
          ...product,
          memberCount: aggregated.memberPremiums.length,
          memberBreakdown: aggregated.memberPremiums,
        },
      } as Plan;
    });
  }

  /**
   * Handle Takaful-specific errors
   */
  protected handleError(error: any): string {
    const message = error.message || String(error);

    if (message.includes('401')) {
      return 'Authentication failed - invalid credentials';
    }
    if (message.includes('422')) {
      return 'Business logic validation failed - check lead data';
    }
    if (message.includes('timeout')) {
      return 'Request timeout - vendor API is slow or unavailable';
    }
    if (message.includes('404')) {
      return 'Endpoint not found - check API version';
    }

    return message;
  }

  // Helper methods

  private extractCoverageAmount(text: string): number {
    if (!text) return 0;
    const match = text.match(/AED\s+([\d,]+)/i);
    if (match) {
      return parseFloat(match[1].replace(/,/g, ''));
    }
    // Try to extract just number
    const numMatch = text.match(/([\d,]+)/);
    return numMatch ? parseFloat(numMatch[1].replace(/,/g, '')) : 0;
  }

  private extractLimit(text: string): number | undefined {
    if (!text) return undefined;
    const match = text.match(/AED\s+([\d,]+)/i);
    return match ? parseFloat(match[1].replace(/,/g, '')) : undefined;
  }

  private extractCoInsurance(text: string): number | undefined {
    if (!text) return undefined;
    const match = text.match(/(\d+)%\s+Co-Insurance/i);
    return match ? parseFloat(match[1]) : undefined;
  }

  private parseBenefits(product: TakafulProduct): any[] {
    const benefits = [];

    if (product.medical_network) {
      benefits.push({ category: 'Network', description: product.medical_network });
    }
    if (product.dental_benefit) {
      benefits.push({ category: 'Dental', description: product.dental_benefit });
    }
    if (product.optical_benefit) {
      benefits.push({ category: 'Optical', description: product.optical_benefit });
    }
    if (product.prescribed_drugs_medicines) {
      benefits.push({ category: 'Pharmacy', description: product.prescribed_drugs_medicines });
    }
    if (product.physiotherapy) {
      benefits.push({ category: 'Physiotherapy', description: product.physiotherapy });
    }
    if (product.maternity) {
      benefits.push({ category: 'Maternity', description: product.maternity });
    }
    if (product.territorial_scope_of_coverage) {
      benefits.push({
        category: 'Coverage Scope',
        description: product.territorial_scope_of_coverage,
      });
    }
    if (product.worldwide_coverage) {
      benefits.push({
        category: 'Worldwide Coverage',
        description: product.worldwide_coverage,
      });
    }

    return benefits;
  }

  private getNextWeekDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  }
}
