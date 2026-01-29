/**
 * Duplicated from interactive-crm-web comparison-utils for backend PDF.
 * Keep in sync when comparison rows change.
 * No React or frontend types.
 */

interface BenefitCategory {
  categoryId: string;
  categoryName: string;
  benefits: Benefit[];
}

interface Benefit {
  name: string;
  covered: boolean;
  description?: string;
  limit?: number;
  limitMetric?: string;
}

interface FormattedItem {
  label: string;
  value: string;
}

export function extractNetworkProvider(plan: any): string {
  const planData = plan.fullPlanData || plan;

  if (planData.network) {
    const parts: string[] = [];
    if (planData.network.networkName) parts.push(planData.network.networkName);
    if (planData.network.tpa) parts.push(planData.network.tpa);
    if (parts.length > 0) return parts.join(' | ');
  }

  if (planData.benefits && Array.isArray(planData.benefits)) {
    const networkCategory = planData.benefits.find((cat: any) =>
      cat.categoryId === 'network' || cat.categoryName?.toLowerCase() === 'network'
    );
    if (networkCategory?.benefits?.length) {
      const v = networkCategory.benefits[0].description || networkCategory.benefits[0].limit || networkCategory.benefits[0].name;
      if (v && v !== 'N/A' && v !== 'Not specified') return v;
    }
  }

  if (planData.lobSpecificData?.networkProviders) return planData.lobSpecificData.networkProviders;

  if (planData.rawPlanData) {
    const parts: string[] = [];
    if (planData.rawPlanData.network) {
      const m = String(planData.rawPlanData.network).match(/^([^-\n]+)/);
      if (m) parts.push(m[1].trim());
    }
    if (planData.rawPlanData.tpa) parts.push(planData.rawPlanData.tpa);
    else if (planData.rawPlanData.coverage_details?.TPA) parts.push(planData.rawPlanData.coverage_details.TPA);
    if (parts.length > 0) return parts.join(' | ');
  }

  return 'N/A';
}

export function extractGeographicalScope(plan: any): string {
  const planData = plan.fullPlanData || plan;

  if (planData.lobSpecificData?.areaOfCover) return planData.lobSpecificData.areaOfCover;

  if (planData.benefits) {
    for (const category of planData.benefits) {
      for (const benefit of category.benefits) {
        const lowerName = benefit.name.toLowerCase();
        const lowerDesc = (benefit.description || '').toLowerCase();
        if (lowerName.includes('worldwide') || lowerDesc.includes('worldwide')) {
          const text = benefit.description || benefit.name;
          const match = text.match(/worldwide coverage:\s*(\w+)/i) || text.match(/:\s*(worldwide)/i);
          if (match) return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
          return 'Worldwide';
        }
      }
    }
  }

  if (planData.rawPlanData?.coverage_details?.['Worldwide coverage'])
    return planData.rawPlanData.coverage_details['Worldwide coverage'];

  return 'UAE';
}

function extractRoomType(plan: any): string {
  const planData = plan.fullPlanData || plan;
  if (planData.benefits) {
    for (const category of planData.benefits) {
      for (const benefit of category.benefits) {
        const searchText = `${benefit.name} ${benefit.description || ''}`.toLowerCase();
        if (searchText.includes('room') && searchText.includes('board')) {
          if (searchText.includes('semi-private')) return 'Semi-Private';
          if (searchText.includes('private')) return 'Private';
          if (searchText.includes('shared')) return 'Shared';
          if (benefit.description) return benefit.description;
        }
      }
    }
  }
  if (planData.rawPlanData?.coverage_details) {
    const roomKey = Object.keys(planData.rawPlanData.coverage_details).find((k) =>
      k.toLowerCase().includes('room') && k.toLowerCase().includes('board')
    );
    if (roomKey) return String(planData.rawPlanData.coverage_details[roomKey]);
  }
  return 'N/A';
}

function extractICUCoverage(plan: any): string {
  const planData = plan.fullPlanData || plan;
  if (planData.benefits) {
    for (const category of planData.benefits) {
      for (const benefit of category.benefits) {
        const searchText = `${benefit.name} ${benefit.description || ''}`.toLowerCase();
        if (searchText.includes('icu') || searchText.includes('ccu') || searchText.includes('intensive care'))
          return benefit.description || benefit.name || 'Covered';
      }
    }
  }
  if (planData.rawPlanData?.coverage_details) {
    for (const [key, value] of Object.entries(planData.rawPlanData.coverage_details)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('icu') || lowerKey.includes('intensive')) return String(value);
    }
  }
  return 'As per policy terms';
}

function extractPrePostHospitalization(plan: any): { pre: string; post: string } {
  const planData = plan.fullPlanData || plan;
  let pre = 'N/A';
  let post = 'N/A';
  if (planData.benefits) {
    for (const category of planData.benefits) {
      for (const benefit of category.benefits) {
        const searchText = `${benefit.name} ${benefit.description || ''}`.toLowerCase();
        if (searchText.includes('pre') && searchText.includes('hospital')) pre = benefit.description || benefit.name;
        if (searchText.includes('post') && searchText.includes('hospital')) post = benefit.description || benefit.name;
      }
    }
  }
  if (planData.rawPlanData?.coverage_details) {
    for (const [key, value] of Object.entries(planData.rawPlanData.coverage_details)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('pre') && lowerKey.includes('hospital')) pre = String(value);
      if (lowerKey.includes('post') && lowerKey.includes('hospital')) post = String(value);
    }
  }
  return { pre, post };
}

function extractMaternityCoverage(plan: any): {
  normal: string;
  csection: string;
  prenatal: string;
  postnatal: string;
  newborn: string;
  miscarriage: string;
} {
  const planData = plan.fullPlanData || plan;
  const result = { normal: 'N/A', csection: 'N/A', prenatal: 'N/A', postnatal: 'N/A', newborn: 'N/A', miscarriage: 'N/A' };
  if (planData.benefits) {
    for (const category of planData.benefits) {
      if (category.categoryName?.toLowerCase().includes('maternity')) {
        for (const benefit of category.benefits) {
          const searchText = `${benefit.name} ${benefit.description || ''}`.toLowerCase();
          if (searchText.includes('normal') && searchText.includes('delivery')) result.normal = benefit.description || benefit.name;
          if (searchText.includes('c-section') || searchText.includes('caesarean') || searchText.includes('cesarean')) result.csection = benefit.description || benefit.name;
          if (searchText.includes('pre') && searchText.includes('natal')) result.prenatal = benefit.description || benefit.name;
          if (searchText.includes('post') && searchText.includes('natal')) result.postnatal = benefit.description || benefit.name;
          if (searchText.includes('newborn') || searchText.includes('new born')) result.newborn = benefit.description || benefit.name;
          if (searchText.includes('miscarriage') || searchText.includes('abortion')) result.miscarriage = benefit.description || benefit.name;
        }
      }
    }
  }
  if (planData.rawPlanData?.coverage_details) {
    for (const [key, value] of Object.entries(planData.rawPlanData.coverage_details)) {
      const lowerKey = key.toLowerCase();
      const strValue = String(value);
      if (lowerKey.includes('maternity') || lowerKey.includes('delivery')) {
        if (lowerKey.includes('normal')) result.normal = strValue;
        if (lowerKey.includes('c-section') || lowerKey.includes('caesarean') || lowerKey.includes('cesarean')) result.csection = strValue;
        if (lowerKey.includes('prenatal') || lowerKey.includes('pre-natal')) result.prenatal = strValue;
        if (lowerKey.includes('postnatal') || lowerKey.includes('post-natal')) result.postnatal = strValue;
        if (lowerKey.includes('newborn')) result.newborn = strValue;
        if (lowerKey.includes('miscarriage') || lowerKey.includes('abortion')) result.miscarriage = strValue;
      }
    }
  }
  return result;
}

function extractDentalDetails(plan: any): { preventive: string; restorative: string; major: string; orthodontics: string } {
  const planData = plan.fullPlanData || plan;
  const result = { preventive: 'N/A', restorative: 'N/A', major: 'N/A', orthodontics: 'N/A' };
  if (planData.benefits) {
    for (const category of planData.benefits) {
      if (category.categoryName?.toLowerCase().includes('dental')) {
        for (const benefit of category.benefits) {
          const searchText = `${benefit.name} ${benefit.description || ''}`.toLowerCase();
          if (searchText.includes('preventive') || searchText.includes('cleaning') || searchText.includes('check')) result.preventive = benefit.description || benefit.name;
          if (searchText.includes('restorative') || searchText.includes('filling')) result.restorative = benefit.description || benefit.name;
          if (searchText.includes('major') || searchText.includes('root canal')) result.major = benefit.description || benefit.name;
          if (searchText.includes('orthodontic')) result.orthodontics = benefit.description || benefit.name;
        }
      }
    }
  }
  if (planData.dentalLimit && planData.dentalLimit > 0) {
    if (result.preventive === 'N/A') result.preventive = 'Covered';
    if (result.restorative === 'N/A') result.restorative = 'Covered';
  }
  return result;
}

function extractOpticalDetails(plan: any): { exam: string; frames: string; contacts: string } {
  const planData = plan.fullPlanData || plan;
  const result = { exam: 'N/A', frames: 'N/A', contacts: 'N/A' };
  if (planData.benefits) {
    for (const category of planData.benefits) {
      if (category.categoryName?.toLowerCase().includes('optical') || category.categoryName?.toLowerCase().includes('vision')) {
        for (const benefit of category.benefits) {
          const searchText = `${benefit.name} ${benefit.description || ''}`.toLowerCase();
          if (searchText.includes('exam') || searchText.includes('test')) result.exam = benefit.description || benefit.name;
          if (searchText.includes('contact')) result.contacts = benefit.description || benefit.name;
          else if (searchText.includes('frame') || searchText.includes('lens') || searchText.includes('glasses')) result.frames = benefit.description || benefit.name;
        }
      }
    }
  }
  if (planData.opticalLimit && planData.opticalLimit > 0) {
    if (result.exam === 'N/A') result.exam = 'Covered';
    if (result.frames === 'N/A') result.frames = 'Covered';
  }
  return result;
}

function extractEmergencyDetails(plan: any): { ambulance: string; er: string } {
  const planData = plan.fullPlanData || plan;
  const result = { ambulance: 'N/A', er: 'N/A' };
  if (planData.benefits) {
    for (const category of planData.benefits) {
      for (const benefit of category.benefits) {
        const searchText = `${benefit.name} ${benefit.description || ''}`.toLowerCase();
        if (searchText.includes('ambulance')) result.ambulance = benefit.description || benefit.name;
        if (searchText.includes('emergency room') || searchText.includes('er ')) result.er = benefit.description || benefit.name;
      }
    }
  }
  if (planData.emergencyLimit && planData.emergencyLimit > 0) {
    if (result.ambulance === 'N/A') result.ambulance = 'Covered';
    if (result.er === 'N/A') result.er = 'Covered';
  }
  return result;
}

export function extractCopayConsultation(plan: any): string {
  const planData = plan.fullPlanData || plan;
  if (planData.rawPlanData?.coverage_details) {
    const copayKey = Object.keys(planData.rawPlanData.coverage_details).find((k) =>
      k.toLowerCase().includes('co-pay') && k.toLowerCase().includes('consultation')
    );
    if (copayKey) {
      const value = planData.rawPlanData.coverage_details[copayKey];
      const lines = String(value).split('\n');
      if (lines[0]) return lines[0].trim();
    }
  }
  if (planData.lobSpecificData?.copayConsultation) return planData.lobSpecificData.copayConsultation;
  const deductible = planData.deductible !== undefined ? planData.deductible : plan.deductible;
  if (deductible && deductible > 0) return `${planData.currency || plan.currency || 'AED'} ${deductible}`;
  return 'NIL';
}

export function formatLimitValue(limit: number | null | undefined, currency: string): string {
  if (limit == null || limit === 0) return 'N/A';
  return `${currency} ${limit.toLocaleString('en-US')}`;
}

function matchesCategory(category: BenefitCategory, targetIds: string[], keywords: string[]): boolean {
  const catIdLower = category.categoryId?.toLowerCase() || '';
  const catNameLower = category.categoryName?.toLowerCase() || '';
  if (targetIds.some((id) => catIdLower.includes(id) || catIdLower === id)) return true;
  return keywords.some((kw) => catNameLower.includes(kw) || catIdLower.includes(kw));
}

function formatMultiLine(items: FormattedItem[]): string {
  const filtered = items.filter(
    (item) =>
      item.value &&
      item.value !== 'N/A' &&
      item.value.trim() !== '' &&
      item.value !== item.label
  );
  if (filtered.length === 0) return '';
  return filtered.map((item) => `${item.label}: ${item.value}`).join('\n');
}

export function extractOutpatientSummary(plan: any): string {
  const planData = plan.fullPlanData || plan;
  const items: FormattedItem[] = [];
  const skipFields = ['bmi', 'height', 'weight', 'age', 'gender', 'name', 'email', 'phone', 'address', 'table of benifits', 'policy wording', 'network list', 'terms and conditions', 'exclusions', 'worldwide coverage'];
  if (planData.benefits) {
    const outpatientCategories = ['outpatient', 'out-patient', 'pharmacy', 'op-co-pay', 'consultation'];
    const outpatientKeywords = ['outpatient', 'out-patient', 'consultation', 'pharmacy', 'copay', 'co-pay'];
    for (const category of planData.benefits) {
      if (matchesCategory(category, outpatientCategories, outpatientKeywords)) {
        for (const benefit of category.benefits) {
          if (benefit.covered && benefit.description) items.push({ label: benefit.name, value: benefit.description });
        }
      }
    }
  }
  if (planData.outpatientLimit && planData.outpatientLimit > 0 && items.length === 0) {
    const currency = planData.currency || plan.currency || 'AED';
    items.push({ label: 'Coverage Limit', value: formatLimitValue(planData.outpatientLimit, currency) });
  }
  if (planData.rawPlanData?.coverage_details) {
    for (const [key, value] of Object.entries(planData.rawPlanData.coverage_details)) {
      const lowerKey = key.toLowerCase();
      if (skipFields.some((skip) => lowerKey.includes(skip))) continue;
      if (lowerKey.includes('outpatient') || lowerKey.includes('out-patient') || lowerKey.includes('consultation') || lowerKey.includes('gp') || lowerKey.includes('specialist') || lowerKey.includes('pharmacy')) {
        const strValue = String(value);
        if (strValue && strValue.length > 2 && !strValue.startsWith('http') && strValue !== key)
          items.push({ label: key, value: strValue.length > 150 ? strValue.substring(0, 150) + '...' : strValue });
      }
    }
  }
  return items.length > 0 ? formatMultiLine(items) : 'NIL';
}

export function extractInpatientSummary(plan: any): string {
  const planData = plan.fullPlanData || plan;
  const items: FormattedItem[] = [];
  const skipFields = ['bmi', 'height', 'weight', 'age', 'gender', 'name', 'email', 'phone', 'table of benifits', 'policy wording', 'network list'];
  const roomType = extractRoomType(plan);
  if (roomType !== 'N/A') items.push({ label: 'Room and Board', value: roomType });
  const icuCoverage = extractICUCoverage(plan);
  if (icuCoverage !== 'As per policy terms' && icuCoverage !== 'N/A') items.push({ label: 'ICU/CCU', value: icuCoverage });
  const prePost = extractPrePostHospitalization(plan);
  if (prePost.pre !== 'N/A' && prePost.pre) items.push({ label: 'Pre-hospitalization', value: prePost.pre });
  if (prePost.post !== 'N/A' && prePost.post) items.push({ label: 'Post-hospitalization', value: prePost.post });
  if (planData.benefits?.length) {
    const inpatientCategory = planData.benefits.find((cat: any) => cat.category === 'inpatient' || cat.categoryId === 'inpatient');
    if (inpatientCategory?.benefits) {
      for (const benefit of inpatientCategory.benefits) {
        const nameLower = benefit.name.toLowerCase();
        const alreadyAdded = items.some((item) => item.label.toLowerCase().includes(nameLower) || nameLower.includes(item.label.toLowerCase()));
        if (!alreadyAdded && benefit.covered && benefit.description) items.push({ label: benefit.name, value: benefit.description || benefit.limit });
      }
    }
  }
  if (planData.inpatientLimit && planData.inpatientLimit > 0 && items.length === 0) {
    const currency = planData.currency || plan.currency || 'AED';
    items.push({ label: 'Inpatient Limit', value: formatLimitValue(planData.inpatientLimit, currency) });
  }
  if (planData.benefits) {
    const inpatientCategories = ['inpatient', 'in-patient', 'hospitalization'];
    const inpatientKeywords = ['inpatient', 'in-patient', 'hospitalization', 'hospital'];
    for (const category of planData.benefits) {
      if (matchesCategory(category, inpatientCategories, inpatientKeywords)) {
        for (const benefit of category.benefits) {
          const benefitLower = benefit.name.toLowerCase();
          const alreadyAdded = items.some((item) => item.label.toLowerCase().includes(benefitLower) || benefitLower.includes(item.label.toLowerCase()));
          if (!alreadyAdded && benefit.covered && benefit.description) items.push({ label: benefit.name, value: benefit.description });
        }
      }
    }
  }
  if (planData.rawPlanData?.coverage_details) {
    for (const [key, value] of Object.entries(planData.rawPlanData.coverage_details)) {
      const lowerKey = key.toLowerCase();
      if (skipFields.some((skip) => lowerKey.includes(skip)) || items.some((item) => item.label.toLowerCase() === lowerKey)) continue;
      if (lowerKey.includes('inpatient') || lowerKey.includes('in-patient') || lowerKey.includes('hospitalization') || lowerKey.includes('surgery')) {
        const strValue = String(value);
        if (strValue && strValue.length > 2 && !strValue.startsWith('http') && strValue !== key)
          items.push({ label: key, value: strValue.length > 150 ? strValue.substring(0, 150) + '...' : strValue });
      }
    }
  }
  return items.length > 0 ? formatMultiLine(items) : 'NIL';
}

export function extractMaternitySummary(plan: any): string {
  const planData = plan.fullPlanData || plan;
  const items: FormattedItem[] = [];
  if (planData.benefits) {
    const maternityCategories = ['maternity', 'pregnancy'];
    const maternityKeywords = ['maternity', 'pregnancy', 'delivery'];
    for (const category of planData.benefits) {
      if (matchesCategory(category, maternityCategories, maternityKeywords)) {
        for (const benefit of category.benefits) {
          if (benefit.covered && benefit.description) items.push({ label: benefit.name, value: benefit.description });
        }
      }
    }
  }
  if (items.length === 0) {
    const maternity = extractMaternityCoverage(plan);
    if (maternity.normal !== 'N/A' && maternity.normal) items.push({ label: 'Normal Delivery', value: maternity.normal });
    if (maternity.csection !== 'N/A' && maternity.csection) items.push({ label: 'Caesarian Section', value: maternity.csection });
    if (maternity.miscarriage !== 'N/A' && maternity.miscarriage) items.push({ label: 'Miscarriage/Legal abortion', value: maternity.miscarriage });
    if (maternity.prenatal !== 'N/A' && maternity.prenatal) items.push({ label: 'Pre-natal Care', value: maternity.prenatal });
    if (maternity.postnatal !== 'N/A' && maternity.postnatal) items.push({ label: 'Post-natal Care', value: maternity.postnatal });
    if (maternity.newborn !== 'N/A' && maternity.newborn) items.push({ label: 'Newborn Coverage', value: maternity.newborn });
  }
  if (planData.maternityLimit && planData.maternityLimit > 0 && items.length === 0) {
    const currency = planData.currency || plan.currency || 'AED';
    items.push({ label: 'Maternity Limit', value: formatLimitValue(planData.maternityLimit, currency) });
  }
  if (planData.rawPlanData?.coverage_details && items.length === 0) {
    for (const [key, value] of Object.entries(planData.rawPlanData.coverage_details)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('maternity') && (lowerKey.includes('co') || lowerKey.includes('insurance'))) {
        const strValue = String(value);
        if (strValue && strValue.length > 2 && !strValue.startsWith('http') && strValue !== key) items.push({ label: key, value: strValue });
      }
    }
  }
  return items.length > 0 ? formatMultiLine(items) : 'NIL';
}

export function extractOtherBenefitsSummary(plan: any): string {
  const planData = plan.fullPlanData || plan;
  const items: FormattedItem[] = [];
  if (planData.benefits) {
    const otherCategories = ['dental', 'optical', 'pharmacy', 'emergency', 'diagnostics', 'physiotherapy'];
    const otherKeywords = ['dental', 'optical', 'vision', 'pharmacy', 'medication', 'emergency', 'ambulance', 'diagnostic', 'physiotherapy'];
    for (const category of planData.benefits) {
      if (matchesCategory(category, otherCategories, otherKeywords)) {
        for (const benefit of category.benefits) {
          if (benefit.covered && benefit.description) items.push({ label: benefit.name, value: benefit.description });
        }
      }
    }
  }
  if (items.length === 0) {
    const dental = extractDentalDetails(plan);
    const dentalItems: string[] = [];
    if (dental.preventive !== 'N/A') dentalItems.push(`Preventive: ${dental.preventive}`);
    if (dental.restorative !== 'N/A') dentalItems.push(`Restorative: ${dental.restorative}`);
    if (dental.major !== 'N/A') dentalItems.push(`Major: ${dental.major}`);
    if (dental.orthodontics !== 'N/A') dentalItems.push(`Orthodontics: ${dental.orthodontics}`);
    if (dentalItems.length > 0) items.push({ label: 'Dental', value: dentalItems.join(', ') });
    else if (planData.dentalLimit && planData.dentalLimit > 0) items.push({ label: 'Dental', value: `Covered up to ${formatLimitValue(planData.dentalLimit, planData.currency || plan.currency || 'AED')}` });
    const optical = extractOpticalDetails(plan);
    const opticalItems: string[] = [];
    if (optical.exam !== 'N/A') opticalItems.push(`Exam: ${optical.exam}`);
    if (optical.frames !== 'N/A') opticalItems.push(`Frames: ${optical.frames}`);
    if (optical.contacts !== 'N/A') opticalItems.push(`Contacts: ${optical.contacts}`);
    if (opticalItems.length > 0) items.push({ label: 'Optical', value: opticalItems.join(', ') });
    else if (planData.opticalLimit && planData.opticalLimit > 0) items.push({ label: 'Optical', value: `Covered up to ${formatLimitValue(planData.opticalLimit, planData.currency || plan.currency || 'AED')}` });
    const emergency = extractEmergencyDetails(plan);
    const emergencyItems: string[] = [];
    if (emergency.ambulance !== 'N/A') emergencyItems.push(`Ambulance: ${emergency.ambulance}`);
    if (emergency.er !== 'N/A') emergencyItems.push(`Emergency Room: ${emergency.er}`);
    if (emergencyItems.length > 0) items.push({ label: 'Emergency', value: emergencyItems.join(', ') });
  }
  if (planData.benefits) {
    for (const category of planData.benefits) {
      const catLower = category.categoryName?.toLowerCase() || '';
      if (catLower.includes('alternative') || catLower.includes('complementary')) {
        for (const benefit of category.benefits) {
          if (benefit.covered && benefit.description) items.push({ label: benefit.name, value: benefit.description });
        }
      }
    }
  }
  return items.length > 0 ? formatMultiLine(items) : 'N/A';
}

export function extractPreExistingSummary(plan: any): string {
  const planData = plan.fullPlanData || plan;
  const items: FormattedItem[] = [];
  const skipFields = ['bmi', 'height', 'weight', 'age', 'gender', 'name'];
  if (planData.benefits?.length) {
    const otherCoverage = planData.benefits.find((cat: any) => cat.category === 'other-coverage' || cat.categoryId === 'other-coverage');
    if (otherCoverage?.benefits) {
      for (const benefit of otherCoverage.benefits) {
        const searchText = `${benefit.name} ${benefit.description || ''}`.toLowerCase();
        if (searchText.includes('pre-existing') || searchText.includes('preexisting') || searchText.includes('waiting period'))
          items.push({ label: benefit.name, value: benefit.description || benefit.limit || 'Covered' });
      }
    }
  }
  if (items.length === 0 && planData.rawPlanData?.coverage_details) {
    for (const [key, value] of Object.entries(planData.rawPlanData.coverage_details)) {
      const lowerKey = key.toLowerCase();
      if (skipFields.some((skip) => lowerKey.includes(skip))) continue;
      if (lowerKey.includes('pre-existing') || lowerKey.includes('preexisting') || (lowerKey.includes('waiting') && lowerKey.includes('period'))) {
        const strValue = String(value);
        if (strValue && strValue.length > 2 && !strValue.startsWith('http') && strValue !== key)
          items.push({ label: key, value: strValue.length > 200 ? strValue.substring(0, 200) + '...' : strValue });
      }
    }
  }
  if (planData.waitingPeriod && planData.waitingPeriod > 0 && items.length === 0)
    items.push({ label: 'Waiting Period', value: `${planData.waitingPeriod} ${planData.waitingPeriodMetric || 'days'}` });
  if (planData.benefits && items.length === 0) {
    for (const category of planData.benefits) {
      for (const benefit of category.benefits) {
        const searchText = `${benefit.name} ${benefit.description || ''}`.toLowerCase();
        if ((searchText.includes('pre-existing') || searchText.includes('preexisting')) && benefit.description)
          items.push({ label: benefit.name, value: benefit.description });
      }
    }
  }
  return items.length > 0 ? formatMultiLine(items) : 'N/A';
}

export function extractBasisOfClaimSummary(plan: any): string {
  const planData = plan.fullPlanData || plan;
  const items: FormattedItem[] = [];
  if (planData.lobSpecificData?.claimsSettlementBasis) {
    const claims = planData.lobSpecificData.claimsSettlementBasis;
    const parts: string[] = [];
    if (claims.withinNetwork?.available && claims.withinNetwork.method) parts.push(`Within Network: ${claims.withinNetwork.method}`);
    if (claims.outsideNetwork?.available && claims.outsideNetwork.method) parts.push(`Outside Network: ${claims.outsideNetwork.method}`);
    if (parts.length > 0) return parts.join(', ');
    return 'N/A';
  }
  if (planData.benefits?.length) {
    const otherCoverage = planData.benefits.find((cat: any) => cat.category === 'other-coverage' || cat.categoryId === 'other-coverage');
    if (otherCoverage?.benefits) {
      for (const benefit of otherCoverage.benefits) {
        const searchText = `${benefit.name} ${benefit.description || ''}`.toLowerCase();
        if (searchText.includes('claim') || searchText.includes('settlement') || searchText.includes('reimbursement') || searchText.includes('billing'))
          items.push({ label: benefit.name, value: benefit.description || benefit.limit || 'Covered' });
      }
    }
  }
  if (items.length === 0 && planData.rawPlanData?.coverage_details) {
    const skipFields = ['bmi', 'height', 'weight', 'age', 'gender', 'name', 'tpa', 'network'];
    for (const [key, value] of Object.entries(planData.rawPlanData.coverage_details)) {
      const lowerKey = key.toLowerCase();
      if (skipFields.some((skip) => lowerKey.includes(skip))) continue;
      if (lowerKey.includes('claim') || lowerKey.includes('settlement') || lowerKey.includes('reimbursement') || lowerKey.includes('billing')) {
        const strValue = String(value);
        if (strValue && strValue.length > 2 && !strValue.startsWith('http') && strValue !== key)
          items.push({ label: key, value: strValue.length > 150 ? strValue.substring(0, 150) + '...' : strValue });
      }
    }
  }
  if (items.length === 0 && planData.lobSpecificData?.claimProcess)
    items.push({ label: 'Claim Process', value: planData.lobSpecificData.claimProcess });
  return items.length > 0 ? formatMultiLine(items) : 'N/A';
}

export function extractAlternativeMedicineSummary(plan: any): string {
  const planData = plan.fullPlanData || plan;
  const items: FormattedItem[] = [];
  if (planData.lobSpecificData?.alternativeMedicine) {
    const altMed = planData.lobSpecificData.alternativeMedicine;
    const parts: string[] = [];
    if (altMed.covered) {
      if (altMed.limit) {
        const currency = planData.currency || plan.currency || 'AED';
        parts.push(`Covered up to ${currency} ${altMed.limit.toLocaleString('en-US')}${altMed.limitMetric ? ' ' + altMed.limitMetric : ' per person per year'}`);
      } else parts.push('Covered');
      if (altMed.coinsurance) parts.push(`${altMed.coinsurance}% coinsurance`);
      if (altMed.reimbursementOnly) parts.push('Reimbursement Only');
      if (parts.length > 0) return parts.join(', ');
    } else return 'Not Covered';
  }
  if (planData.benefits?.length) {
    const altCategory = planData.benefits.find((cat: any) => cat.category === 'alternative' || cat.categoryId === 'alternative');
    if (altCategory?.benefits) {
      for (const benefit of altCategory.benefits) {
        if (benefit.description || benefit.limit) {
          const value = benefit.covered ? (benefit.description || benefit.limit) : 'No Benefit';
          items.push({ label: benefit.name, value: value });
        }
      }
    }
  }
  if (items.length === 0 && planData.rawPlanData?.coverage_details) {
    for (const [key, value] of Object.entries(planData.rawPlanData.coverage_details)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('alternative') || lowerKey.includes('medicine')) items.push({ label: key, value: String(value) });
    }
  }
  return items.length > 0 ? formatMultiLine(items) : 'N/A';
}
