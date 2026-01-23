/**
 * Al Sagr EMAF Template Seed Data
 * Extracted from Al Sagr National Insurance Medical Application Form
 */

import { FormSection, FormQuestion, DocumentRequirement } from '../models/emafTypes';
import { v4 as uuidv4 } from 'uuid';

export const alSagrTemplateSections: FormSection[] = [
  {
    id: uuidv4(),
    title: 'Policy Holder Information',
    order: 1,
    questions: [
      {
        id: uuidv4(),
        label: 'Full Name',
        dataKey: 'policyHolder_fullName',
        type: 'text',
        order: 1,
        placeholder: 'Enter full name',
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Employer',
        dataKey: 'policyHolder_employer',
        type: 'text',
        order: 2,
        placeholder: 'Enter employer name'
      },
      {
        id: uuidv4(),
        label: 'Nationality',
        dataKey: 'policyHolder_nationality',
        type: 'text',
        order: 3,
        placeholder: 'Enter nationality',
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Emirates ID',
        dataKey: 'policyHolder_emiratesId',
        type: 'text',
        order: 4,
        placeholder: 'xxx-xxxx-xxxxxxx-x',
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Emirate',
        dataKey: 'policyHolder_emirate',
        type: 'dropdown',
        order: 5,
        options: [
          { label: 'Abu Dhabi', value: 'abu_dhabi' },
          { label: 'Dubai', value: 'dubai' },
          { label: 'Sharjah', value: 'sharjah' },
          { label: 'Ajman', value: 'ajman' },
          { label: 'Umm Al Quwain', value: 'uaq' },
          { label: 'Ras Al Khaimah', value: 'rak' },
          { label: 'Fujairah', value: 'fujairah' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Marital Status',
        dataKey: 'policyHolder_maritalStatus',
        type: 'dropdown',
        order: 6,
        options: [
          { label: 'Single', value: 'single' },
          { label: 'Married', value: 'married' },
          { label: 'Divorced', value: 'divorced' },
          { label: 'Widowed', value: 'widowed' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Date of Birth',
        dataKey: 'policyHolder_dob',
        type: 'date',
        order: 7,
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Gender',
        dataKey: 'policyHolder_gender',
        type: 'radio',
        order: 8,
        options: [
          { label: 'Male', value: 'male' },
          { label: 'Female', value: 'female' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Height (cm)',
        dataKey: 'policyHolder_height',
        type: 'number',
        order: 9,
        placeholder: 'Enter height in cm',
        validation: { required: true, min: 50, max: 250 }
      },
      {
        id: uuidv4(),
        label: 'Weight (kg)',
        dataKey: 'policyHolder_weight',
        type: 'number',
        order: 10,
        placeholder: 'Enter weight in kg',
        validation: { required: true, min: 20, max: 300 }
      },
      {
        id: uuidv4(),
        label: 'Mobile Number',
        dataKey: 'policyHolder_mobile',
        type: 'phone',
        order: 11,
        placeholder: '+971-xx-xxx-xxxx',
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Contact Number',
        dataKey: 'policyHolder_contactNumber',
        type: 'phone',
        order: 12,
        placeholder: '+971-xx-xxx-xxxx'
      },
      {
        id: uuidv4(),
        label: 'Email Address',
        dataKey: 'policyHolder_email',
        type: 'email',
        order: 13,
        placeholder: 'example@email.com',
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Occupation',
        dataKey: 'policyHolder_occupation',
        type: 'text',
        order: 14,
        placeholder: 'Enter occupation'
      },
      {
        id: uuidv4(),
        label: 'Location/Address',
        dataKey: 'policyHolder_location',
        type: 'text',
        order: 15,
        placeholder: 'Enter residential address'
      }
    ]
  },
  {
    id: uuidv4(),
    title: 'Insured Members Information',
    order: 2,
    questions: [
      // Principal
      {
        id: uuidv4(),
        label: 'Principal - Name',
        dataKey: 'principal_name',
        type: 'text',
        order: 1,
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Principal - Relation to Policy Holder',
        dataKey: 'principal_relation',
        type: 'dropdown',
        order: 2,
        options: [
          { label: 'Self', value: 'self' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Principal - Gender',
        dataKey: 'principal_gender',
        type: 'radio',
        order: 3,
        options: [
          { label: 'Male', value: 'male' },
          { label: 'Female', value: 'female' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Principal - Marital Status',
        dataKey: 'principal_maritalStatus',
        type: 'dropdown',
        order: 4,
        options: [
          { label: 'Single', value: 'single' },
          { label: 'Married', value: 'married' },
          { label: 'Divorced', value: 'divorced' },
          { label: 'Widowed', value: 'widowed' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Principal - Date of Birth',
        dataKey: 'principal_dob',
        type: 'date',
        order: 5,
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Principal - Height (cm)',
        dataKey: 'principal_height',
        type: 'number',
        order: 6,
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Principal - Weight (kg)',
        dataKey: 'principal_weight',
        type: 'number',
        order: 7,
        validation: { required: true }
      },
      // Spouse
      {
        id: uuidv4(),
        label: 'Spouse - Name',
        dataKey: 'spouse_name',
        type: 'text',
        order: 8
      },
      {
        id: uuidv4(),
        label: 'Spouse - Relation to Policy Holder',
        dataKey: 'spouse_relation',
        type: 'dropdown',
        order: 9,
        options: [
          { label: 'Spouse', value: 'spouse' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Spouse - Gender',
        dataKey: 'spouse_gender',
        type: 'radio',
        order: 10,
        options: [
          { label: 'Male', value: 'male' },
          { label: 'Female', value: 'female' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Spouse - Marital Status',
        dataKey: 'spouse_maritalStatus',
        type: 'dropdown',
        order: 11,
        options: [
          { label: 'Single', value: 'single' },
          { label: 'Married', value: 'married' },
          { label: 'Divorced', value: 'divorced' },
          { label: 'Widowed', value: 'widowed' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Spouse - Date of Birth',
        dataKey: 'spouse_dob',
        type: 'date',
        order: 12
      },
      {
        id: uuidv4(),
        label: 'Spouse - Height (cm)',
        dataKey: 'spouse_height',
        type: 'number',
        order: 13
      },
      {
        id: uuidv4(),
        label: 'Spouse - Weight (kg)',
        dataKey: 'spouse_weight',
        type: 'number',
        order: 14
      },
      // Dependent 1-5 (simplified - only essential fields)
      ...Array.from({ length: 5 }, (_, i) => [
        {
          id: uuidv4(),
          label: `Dependent ${i + 1} - Name`,
          dataKey: `dependent${i + 1}_name`,
          type: 'text' as const,
          order: 15 + (i * 7)
        },
        {
          id: uuidv4(),
          label: `Dependent ${i + 1} - Relation to Policy Holder`,
          dataKey: `dependent${i + 1}_relation`,
          type: 'dropdown' as const,
          order: 16 + (i * 7),
          options: [
            { label: 'Son', value: 'son' },
            { label: 'Daughter', value: 'daughter' },
            { label: 'Parent', value: 'parent' }
          ]
        },
        {
          id: uuidv4(),
          label: `Dependent ${i + 1} - Gender`,
          dataKey: `dependent${i + 1}_gender`,
          type: 'radio' as const,
          order: 17 + (i * 7),
          options: [
            { label: 'Male', value: 'male' },
            { label: 'Female', value: 'female' }
          ]
        },
        {
          id: uuidv4(),
          label: `Dependent ${i + 1} - Marital Status`,
          dataKey: `dependent${i + 1}_maritalStatus`,
          type: 'dropdown' as const,
          order: 18 + (i * 7),
          options: [
            { label: 'Single', value: 'single' },
            { label: 'Married', value: 'married' },
            { label: 'Divorced', value: 'divorced' },
            { label: 'Widowed', value: 'widowed' }
          ]
        },
        {
          id: uuidv4(),
          label: `Dependent ${i + 1} - Date of Birth`,
          dataKey: `dependent${i + 1}_dob`,
          type: 'date' as const,
          order: 19 + (i * 7)
        },
        {
          id: uuidv4(),
          label: `Dependent ${i + 1} - Height (cm)`,
          dataKey: `dependent${i + 1}_height`,
          type: 'number' as const,
          order: 20 + (i * 7)
        },
        {
          id: uuidv4(),
          label: `Dependent ${i + 1} - Weight (kg)`,
          dataKey: `dependent${i + 1}_weight`,
          type: 'number' as const,
          order: 21 + (i * 7)
        }
      ]).flat()
    ]
  },
  // COMMENTED OUT: Previous Insurance History - Not needed for simplified form
  /* {
    id: uuidv4(),
    title: 'Previous Insurance History',
    order: 3,
    questions: [
      {
        id: uuidv4(),
        label: 'Principal - Previous Insurance Company',
        dataKey: 'principal_prevInsuranceCompany',
        type: 'text',
        order: 1,
        placeholder: 'Enter insurance company name'
      },
      {
        id: uuidv4(),
        label: 'Principal - Policy Expiry Date',
        dataKey: 'principal_prevPolicyExpiry',
        type: 'date',
        order: 2
      },
      {
        id: uuidv4(),
        label: 'Spouse - Previous Insurance Company',
        dataKey: 'spouse_prevInsuranceCompany',
        type: 'text',
        order: 3
      },
      {
        id: uuidv4(),
        label: 'Spouse - Policy Expiry Date',
        dataKey: 'spouse_prevPolicyExpiry',
        type: 'date',
        order: 4
      },
      {
        id: uuidv4(),
        label: 'Any family member not applied for insurance in this application?',
        dataKey: 'familyMember_notApplied',
        type: 'radio',
        order: 5,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, provide details of existing insurance arrangements',
        dataKey: 'familyMember_notApplied_details',
        type: 'text',
        order: 6,
        placeholder: 'Enter details'
      }
    ]
  }, */
  // Medical History Declaration - 15 Questions
  {
    id: uuidv4(),
    title: 'Medical History Declaration',
    order: 3,
    questions: [
      // Question 1: Under medical observation / treatment
      {
        id: uuidv4(),
        label: 'Are you currently under medical observation or treatment?',
        dataKey: 'medical_observation_treatment',
        type: 'radio',
        order: 1,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      // Question 2: Taking medication (with details field)
      {
        id: uuidv4(),
        label: 'Are you currently taking any medication?',
        dataKey: 'medical_taking_medication',
        type: 'radio',
        order: 2,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, please provide medication details',
        dataKey: 'medical_medication_details',
        type: 'text',
        order: 3,
        placeholder: 'List all medications with dosage and reason'
      },
      // Question 3: Past / advised surgery
      {
        id: uuidv4(),
        label: 'Have you had any surgery in the past or been advised to undergo surgery?',
        dataKey: 'medical_past_advised_surgery',
        type: 'radio',
        order: 4,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      // Question 4: Blood / imaging tests in last 5 years (with attachment)
      {
        id: uuidv4(),
        label: 'Have you undergone any blood tests or imaging tests in the last 5 years?',
        dataKey: 'medical_blood_imaging_tests',
        type: 'radio',
        order: 5,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, upload test results (optional)',
        dataKey: 'medical_test_results_attachment',
        type: 'text',
        order: 6,
        placeholder: 'Note: You can upload test results in the documents section',
        helperText: 'Upload supporting documents in the Required Documents section below'
      },
      // Question 5: Physical disability / physiotherapy
      {
        id: uuidv4(),
        label: 'Do you have any physical disability or require physiotherapy?',
        dataKey: 'medical_physical_disability',
        type: 'radio',
        order: 7,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      // Question 6: Pre-existing / chronic condition
      {
        id: uuidv4(),
        label: 'Do you have any pre-existing or chronic medical condition?',
        dataKey: 'medical_preexisting_chronic',
        type: 'radio',
        order: 8,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      // Question 7: Cancer history (with details)
      {
        id: uuidv4(),
        label: 'Do you have any history of cancer?',
        dataKey: 'medical_cancer_history',
        type: 'radio',
        order: 9,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, please provide cancer details',
        dataKey: 'medical_cancer_details',
        type: 'text',
        order: 10,
        placeholder: 'Type, diagnosis date, treatment, current status'
      },
      // Question 8: Endocrine / metabolic disorders (with conditional fields)
      {
        id: uuidv4(),
        label: 'Do you have any endocrine or metabolic disorders (diabetes, thyroid, etc.)?',
        dataKey: 'medical_endocrine_metabolic',
        type: 'radio',
        order: 11,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, specify condition type',
        dataKey: 'medical_endocrine_type',
        type: 'dropdown',
        order: 12,
        options: [
          { label: 'Type 1 Diabetes', value: 'diabetes_type1' },
          { label: 'Type 2 Diabetes', value: 'diabetes_type2' },
          { label: 'Hypothyroidism', value: 'hypothyroidism' },
          { label: 'Hyperthyroidism', value: 'hyperthyroidism' },
          { label: 'Other', value: 'other' }
        ]
      },
      // Question 9: Respiratory system diseases
      {
        id: uuidv4(),
        label: 'Do you have any respiratory system diseases?',
        dataKey: 'medical_respiratory',
        type: 'radio',
        order: 13,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      // Question 10: Digestive system diseases
      {
        id: uuidv4(),
        label: 'Do you have any digestive system diseases?',
        dataKey: 'medical_digestive',
        type: 'radio',
        order: 14,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      // Question 11: Musculoskeletal disorders
      {
        id: uuidv4(),
        label: 'Do you have any musculoskeletal disorders?',
        dataKey: 'medical_musculoskeletal',
        type: 'radio',
        order: 15,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      // Question 12: Cardiovascular diseases (with BP fields)
      {
        id: uuidv4(),
        label: 'Do you have any cardiovascular diseases?',
        dataKey: 'medical_cardiovascular',
        type: 'radio',
        order: 16,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Systolic Blood Pressure (if applicable)',
        dataKey: 'medical_bp_systolic',
        type: 'number',
        order: 17,
        placeholder: 'e.g., 120'
      },
      {
        id: uuidv4(),
        label: 'Diastolic Blood Pressure (if applicable)',
        dataKey: 'medical_bp_diastolic',
        type: 'number',
        order: 18,
        placeholder: 'e.g., 80'
      },
      // Question 13: Genitourinary diseases
      {
        id: uuidv4(),
        label: 'Do you have any genitourinary diseases?',
        dataKey: 'medical_genitourinary',
        type: 'radio',
        order: 19,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      // Question 14: Eye diseases
      {
        id: uuidv4(),
        label: 'Do you have any eye diseases?',
        dataKey: 'medical_eye',
        type: 'radio',
        order: 20,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      // Question 15: Skin disorders
      {
        id: uuidv4(),
        label: 'Do you have any skin disorders?',
        dataKey: 'medical_skin',
        type: 'radio',
        order: 21,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      }
    ]
  },
  // COMMENTED OUT: Medical History Declaration (Table) - Not needed for simplified form
  /* {
    id: uuidv4(),
    title: 'Medical History Declaration (Table)',
    order: 4,
    questions: [
      // Row 1: Medical observation/treatment - for each person
      {
        id: uuidv4(),
        label: 'Principal - Medical observation, undergoing treatment, or have received advice?',
        dataKey: 'principal_medical_observation',
        type: 'radio',
        order: 1,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 1 - Medical observation, undergoing treatment, or have received advice?',
        dataKey: 'dependent1_medical_observation',
        type: 'radio',
        order: 2,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 2 - Medical observation, undergoing treatment, or have received advice?',
        dataKey: 'dependent2_medical_observation',
        type: 'radio',
        order: 3,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 3 - Medical observation, undergoing treatment, or have received advice?',
        dataKey: 'dependent3_medical_observation',
        type: 'radio',
        order: 4,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 4 - Medical observation, undergoing treatment, or have received advice?',
        dataKey: 'dependent4_medical_observation',
        type: 'radio',
        order: 5,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 5 - Medical observation, undergoing treatment, or have received advice?',
        dataKey: 'dependent5_medical_observation',
        type: 'radio',
        order: 6,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      // Row 2: Medications - for each person
      {
        id: uuidv4(),
        label: 'Principal - Taking medications (pharmaceutical/alternative medicine) or advised?',
        dataKey: 'principal_medical_medications',
        type: 'radio',
        order: 7,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 1 - Taking medications (pharmaceutical/alternative medicine) or advised?',
        dataKey: 'dependent1_medical_medications',
        type: 'radio',
        order: 8,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 2 - Taking medications (pharmaceutical/alternative medicine) or advised?',
        dataKey: 'dependent2_medical_medications',
        type: 'radio',
        order: 9,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 3 - Taking medications (pharmaceutical/alternative medicine) or advised?',
        dataKey: 'dependent3_medical_medications',
        type: 'radio',
        order: 10,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 4 - Taking medications (pharmaceutical/alternative medicine) or advised?',
        dataKey: 'dependent4_medical_medications',
        type: 'radio',
        order: 11,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 5 - Taking medications (pharmaceutical/alternative medicine) or advised?',
        dataKey: 'dependent5_medical_medications',
        type: 'radio',
        order: 12,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      // Row 3: Surgery - for each person
      {
        id: uuidv4(),
        label: 'Principal - Had surgery in the past or advised to undergo surgery in near future?',
        dataKey: 'principal_medical_surgery',
        type: 'radio',
        order: 13,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 1 - Had surgery in the past or advised to undergo surgery in near future?',
        dataKey: 'dependent1_medical_surgery',
        type: 'radio',
        order: 14,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 2 - Had surgery in the past or advised to undergo surgery in near future?',
        dataKey: 'dependent2_medical_surgery',
        type: 'radio',
        order: 15,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 3 - Had surgery in the past or advised to undergo surgery in near future?',
        dataKey: 'dependent3_medical_surgery',
        type: 'radio',
        order: 16,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 4 - Had surgery in the past or advised to undergo surgery in near future?',
        dataKey: 'dependent4_medical_surgery',
        type: 'radio',
        order: 17,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 5 - Had surgery in the past or advised to undergo surgery in near future?',
        dataKey: 'dependent5_medical_surgery',
        type: 'radio',
        order: 18,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      // Row 4: Blood tests/imaging - for each person
      {
        id: uuidv4(),
        label: 'Principal - Blood tests or imaging tests (Ultrasound, X-ray, CT-Scan, MRI) in last 5 years?',
        dataKey: 'principal_medical_bloodTests',
        type: 'radio',
        order: 19,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 1 - Blood tests or imaging tests (Ultrasound, X-ray, CT-Scan, MRI) in last 5 years?',
        dataKey: 'dependent1_medical_bloodTests',
        type: 'radio',
        order: 20,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 2 - Blood tests or imaging tests (Ultrasound, X-ray, CT-Scan, MRI) in last 5 years?',
        dataKey: 'dependent2_medical_bloodTests',
        type: 'radio',
        order: 21,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 3 - Blood tests or imaging tests (Ultrasound, X-ray, CT-Scan, MRI) in last 5 years?',
        dataKey: 'dependent3_medical_bloodTests',
        type: 'radio',
        order: 22,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 4 - Blood tests or imaging tests (Ultrasound, X-ray, CT-Scan, MRI) in last 5 years?',
        dataKey: 'dependent4_medical_bloodTests',
        type: 'radio',
        order: 23,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Dependent 5 - Blood tests or imaging tests (Ultrasound, X-ray, CT-Scan, MRI) in last 5 years?',
        dataKey: 'dependent5_medical_bloodTests',
        type: 'radio',
        order: 24,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      
      // ============ NEW QUESTIONS 5-15 (66 QUESTIONS TOTAL) ============
      
      // Row 5: Physical disability/physiotherapy
      {
        id: uuidv4(),
        label: 'Principal - Physical problems/disability requiring physiotherapy?',
        dataKey: 'principal_medical_physicalDisability',
        type: 'radio',
        order: 25,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 1 - Physical problems/disability requiring physiotherapy?',
        dataKey: 'dependent1_medical_physicalDisability',
        type: 'radio',
        order: 26,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 2 - Physical problems/disability requiring physiotherapy?',
        dataKey: 'dependent2_medical_physicalDisability',
        type: 'radio',
        order: 27,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 3 - Physical problems/disability requiring physiotherapy?',
        dataKey: 'dependent3_medical_physicalDisability',
        type: 'radio',
        order: 28,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 4 - Physical problems/disability requiring physiotherapy?',
        dataKey: 'dependent4_medical_physicalDisability',
        type: 'radio',
        order: 29,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 5 - Physical problems/disability requiring physiotherapy?',
        dataKey: 'dependent5_medical_physicalDisability',
        type: 'radio',
        order: 30,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },

      // Row 6: Pre-existing/chronic conditions
      {
        id: uuidv4(),
        label: 'Principal - Pre-existing or chronic conditions?',
        dataKey: 'principal_medical_chronicConditions',
        type: 'radio',
        order: 31,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 1 - Pre-existing or chronic conditions?',
        dataKey: 'dependent1_medical_chronicConditions',
        type: 'radio',
        order: 32,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 2 - Pre-existing or chronic conditions?',
        dataKey: 'dependent2_medical_chronicConditions',
        type: 'radio',
        order: 33,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 3 - Pre-existing or chronic conditions?',
        dataKey: 'dependent3_medical_chronicConditions',
        type: 'radio',
        order: 34,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 4 - Pre-existing or chronic conditions?',
        dataKey: 'dependent4_medical_chronicConditions',
        type: 'radio',
        order: 35,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 5 - Pre-existing or chronic conditions?',
        dataKey: 'dependent5_medical_chronicConditions',
        type: 'radio',
        order: 36,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },

      // Row 7: Cancer diagnosis
      {
        id: uuidv4(),
        label: 'Principal - Cancer diagnosis/treatment/cured?',
        dataKey: 'principal_medical_cancerDiagnosis',
        type: 'radio',
        order: 37,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 1 - Cancer diagnosis/treatment/cured?',
        dataKey: 'dependent1_medical_cancerDiagnosis',
        type: 'radio',
        order: 38,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 2 - Cancer diagnosis/treatment/cured?',
        dataKey: 'dependent2_medical_cancerDiagnosis',
        type: 'radio',
        order: 39,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 3 - Cancer diagnosis/treatment/cured?',
        dataKey: 'dependent3_medical_cancerDiagnosis',
        type: 'radio',
        order: 40,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 4 - Cancer diagnosis/treatment/cured?',
        dataKey: 'dependent4_medical_cancerDiagnosis',
        type: 'radio',
        order: 41,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 5 - Cancer diagnosis/treatment/cured?',
        dataKey: 'dependent5_medical_cancerDiagnosis',
        type: 'radio',
        order: 42,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },

      // Row 8: Endocrine/Metabolic system
      {
        id: uuidv4(),
        label: 'Principal - Endocrine/Metabolic/Immunity (diabetes, thyroid, etc.)?',
        dataKey: 'principal_medical_endocrineMetabolic',
        type: 'radio',
        order: 43,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 1 - Endocrine/Metabolic/Immunity (diabetes, thyroid, etc.)?',
        dataKey: 'dependent1_medical_endocrineMetabolic',
        type: 'radio',
        order: 44,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 2 - Endocrine/Metabolic/Immunity (diabetes, thyroid, etc.)?',
        dataKey: 'dependent2_medical_endocrineMetabolic',
        type: 'radio',
        order: 45,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 3 - Endocrine/Metabolic/Immunity (diabetes, thyroid, etc.)?',
        dataKey: 'dependent3_medical_endocrineMetabolic',
        type: 'radio',
        order: 46,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 4 - Endocrine/Metabolic/Immunity (diabetes, thyroid, etc.)?',
        dataKey: 'dependent4_medical_endocrineMetabolic',
        type: 'radio',
        order: 47,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 5 - Endocrine/Metabolic/Immunity (diabetes, thyroid, etc.)?',
        dataKey: 'dependent5_medical_endocrineMetabolic',
        type: 'radio',
        order: 48,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },

      // Row 9: Respiratory System
      {
        id: uuidv4(),
        label: 'Principal - Respiratory System (Sinusitis, allergies, asthma, etc.)?',
        dataKey: 'principal_medical_respiratorySystem',
        type: 'radio',
        order: 49,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 1 - Respiratory System (Sinusitis, allergies, asthma, etc.)?',
        dataKey: 'dependent1_medical_respiratorySystem',
        type: 'radio',
        order: 50,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 2 - Respiratory System (Sinusitis, allergies, asthma, etc.)?',
        dataKey: 'dependent2_medical_respiratorySystem',
        type: 'radio',
        order: 51,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 3 - Respiratory System (Sinusitis, allergies, asthma, etc.)?',
        dataKey: 'dependent3_medical_respiratorySystem',
        type: 'radio',
        order: 52,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 4 - Respiratory System (Sinusitis, allergies, asthma, etc.)?',
        dataKey: 'dependent4_medical_respiratorySystem',
        type: 'radio',
        order: 53,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 5 - Respiratory System (Sinusitis, allergies, asthma, etc.)?',
        dataKey: 'dependent5_medical_respiratorySystem',
        type: 'radio',
        order: 54,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },

      // Row 10: Digestive System
      {
        id: uuidv4(),
        label: 'Principal - Digestive System (Acid reflux, ulcers, liver, etc.)?',
        dataKey: 'principal_medical_digestiveSystem',
        type: 'radio',
        order: 55,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 1 - Digestive System (Acid reflux, ulcers, liver, etc.)?',
        dataKey: 'dependent1_medical_digestiveSystem',
        type: 'radio',
        order: 56,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 2 - Digestive System (Acid reflux, ulcers, liver, etc.)?',
        dataKey: 'dependent2_medical_digestiveSystem',
        type: 'radio',
        order: 57,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 3 - Digestive System (Acid reflux, ulcers, liver, etc.)?',
        dataKey: 'dependent3_medical_digestiveSystem',
        type: 'radio',
        order: 58,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 4 - Digestive System (Acid reflux, ulcers, liver, etc.)?',
        dataKey: 'dependent4_medical_digestiveSystem',
        type: 'radio',
        order: 59,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 5 - Digestive System (Acid reflux, ulcers, liver, etc.)?',
        dataKey: 'dependent5_medical_digestiveSystem',
        type: 'radio',
        order: 60,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },

      // Row 11: Musculoskeletal System
      {
        id: uuidv4(),
        label: 'Principal - Musculoskeletal/Connective tissue (fracture, arthritis, etc.)?',
        dataKey: 'principal_medical_musculoskeletalSystem',
        type: 'radio',
        order: 61,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 1 - Musculoskeletal/Connective tissue (fracture, arthritis, etc.)?',
        dataKey: 'dependent1_medical_musculoskeletalSystem',
        type: 'radio',
        order: 62,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 2 - Musculoskeletal/Connective tissue (fracture, arthritis, etc.)?',
        dataKey: 'dependent2_medical_musculoskeletalSystem',
        type: 'radio',
        order: 63,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 3 - Musculoskeletal/Connective tissue (fracture, arthritis, etc.)?',
        dataKey: 'dependent3_medical_musculoskeletalSystem',
        type: 'radio',
        order: 64,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 4 - Musculoskeletal/Connective tissue (fracture, arthritis, etc.)?',
        dataKey: 'dependent4_medical_musculoskeletalSystem',
        type: 'radio',
        order: 65,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 5 - Musculoskeletal/Connective tissue (fracture, arthritis, etc.)?',
        dataKey: 'dependent5_medical_musculoskeletalSystem',
        type: 'radio',
        order: 66,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },

      // Row 12: Cardiovascular System
      {
        id: uuidv4(),
        label: 'Principal - Cardiovascular System (stroke, hypertension, heart disease, etc.)?',
        dataKey: 'principal_medical_cardiovascularSystem',
        type: 'radio',
        order: 67,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 1 - Cardiovascular System (stroke, hypertension, heart disease, etc.)?',
        dataKey: 'dependent1_medical_cardiovascularSystem',
        type: 'radio',
        order: 68,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 2 - Cardiovascular System (stroke, hypertension, heart disease, etc.)?',
        dataKey: 'dependent2_medical_cardiovascularSystem',
        type: 'radio',
        order: 69,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 3 - Cardiovascular System (stroke, hypertension, heart disease, etc.)?',
        dataKey: 'dependent3_medical_cardiovascularSystem',
        type: 'radio',
        order: 70,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 4 - Cardiovascular System (stroke, hypertension, heart disease, etc.)?',
        dataKey: 'dependent4_medical_cardiovascularSystem',
        type: 'radio',
        order: 71,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 5 - Cardiovascular System (stroke, hypertension, heart disease, etc.)?',
        dataKey: 'dependent5_medical_cardiovascularSystem',
        type: 'radio',
        order: 72,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },

      // Row 13: Genitourinary System
      {
        id: uuidv4(),
        label: 'Principal - Genitourinary System (kidney, bladder, prostate, etc.)?',
        dataKey: 'principal_medical_genitourinarySystem',
        type: 'radio',
        order: 73,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 1 - Genitourinary System (kidney, bladder, prostate, etc.)?',
        dataKey: 'dependent1_medical_genitourinarySystem',
        type: 'radio',
        order: 74,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 2 - Genitourinary System (kidney, bladder, prostate, etc.)?',
        dataKey: 'dependent2_medical_genitourinarySystem',
        type: 'radio',
        order: 75,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 3 - Genitourinary System (kidney, bladder, prostate, etc.)?',
        dataKey: 'dependent3_medical_genitourinarySystem',
        type: 'radio',
        order: 76,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 4 - Genitourinary System (kidney, bladder, prostate, etc.)?',
        dataKey: 'dependent4_medical_genitourinarySystem',
        type: 'radio',
        order: 77,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 5 - Genitourinary System (kidney, bladder, prostate, etc.)?',
        dataKey: 'dependent5_medical_genitourinarySystem',
        type: 'radio',
        order: 78,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },

      // Row 14: Eye Disease
      {
        id: uuidv4(),
        label: 'Principal - Eye Disease (Cataract, vision correction surgery, etc.)?',
        dataKey: 'principal_medical_eyeDisease',
        type: 'radio',
        order: 79,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 1 - Eye Disease (Cataract, vision correction surgery, etc.)?',
        dataKey: 'dependent1_medical_eyeDisease',
        type: 'radio',
        order: 80,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 2 - Eye Disease (Cataract, vision correction surgery, etc.)?',
        dataKey: 'dependent2_medical_eyeDisease',
        type: 'radio',
        order: 81,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 3 - Eye Disease (Cataract, vision correction surgery, etc.)?',
        dataKey: 'dependent3_medical_eyeDisease',
        type: 'radio',
        order: 82,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 4 - Eye Disease (Cataract, vision correction surgery, etc.)?',
        dataKey: 'dependent4_medical_eyeDisease',
        type: 'radio',
        order: 83,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 5 - Eye Disease (Cataract, vision correction surgery, etc.)?',
        dataKey: 'dependent5_medical_eyeDisease',
        type: 'radio',
        order: 84,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },

      // Row 15: Skin Disorders
      {
        id: uuidv4(),
        label: 'Principal - Skin disorders (Psoriasis, Chronic dermatitis, allergies, etc.)?',
        dataKey: 'principal_medical_skinDisorders',
        type: 'radio',
        order: 85,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 1 - Skin disorders (Psoriasis, Chronic dermatitis, allergies, etc.)?',
        dataKey: 'dependent1_medical_skinDisorders',
        type: 'radio',
        order: 86,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 2 - Skin disorders (Psoriasis, Chronic dermatitis, allergies, etc.)?',
        dataKey: 'dependent2_medical_skinDisorders',
        type: 'radio',
        order: 87,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 3 - Skin disorders (Psoriasis, Chronic dermatitis, allergies, etc.)?',
        dataKey: 'dependent3_medical_skinDisorders',
        type: 'radio',
        order: 88,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 4 - Skin disorders (Psoriasis, Chronic dermatitis, allergies, etc.)?',
        dataKey: 'dependent4_medical_skinDisorders',
        type: 'radio',
        order: 89,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      },
      {
        id: uuidv4(),
        label: 'Dependent 5 - Skin disorders (Psoriasis, Chronic dermatitis, allergies, etc.)?',
        dataKey: 'dependent5_medical_skinDisorders',
        type: 'radio',
        order: 90,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
      }
    ]
  }, */
  // COMMENTED OUT: Medical History - General Questions - Not needed for simplified form
  /* {
    id: uuidv4(),
    title: 'Medical History - General Questions',
    order: 5,
    questions: [
      {
        id: uuidv4(),
        label: 'Have you ever been diagnosed or received treatment for Heart Disease?',
        dataKey: 'medical_heartDisease',
        type: 'radio',
        order: 1,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, provide details for Heart Disease',
        dataKey: 'medical_heartDisease_details',
        type: 'text',
        order: 2,
        placeholder: 'Provide diagnosis date, treatment details, current status'
      },
      {
        id: uuidv4(),
        label: 'Have you ever been diagnosed or received treatment for High Blood Pressure?',
        dataKey: 'medical_highBloodPressure',
        type: 'radio',
        order: 3,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, provide details for High Blood Pressure',
        dataKey: 'medical_highBloodPressure_details',
        type: 'text',
        order: 4
      },
      {
        id: uuidv4(),
        label: 'Have you ever been diagnosed or received treatment for Diabetes?',
        dataKey: 'medical_diabetes',
        type: 'radio',
        order: 5,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, provide details for Diabetes',
        dataKey: 'medical_diabetes_details',
        type: 'text',
        order: 6
      },
      {
        id: uuidv4(),
        label: 'Have you ever been diagnosed or received treatment for High Cholesterol?',
        dataKey: 'medical_highCholesterol',
        type: 'radio',
        order: 7,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, provide details for High Cholesterol',
        dataKey: 'medical_highCholesterol_details',
        type: 'text',
        order: 8
      },
      {
        id: uuidv4(),
        label: 'Have you ever been diagnosed or received treatment for Asthma or Respiratory Disease?',
        dataKey: 'medical_asthma',
        type: 'radio',
        order: 9,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, provide details for Asthma/Respiratory Disease',
        dataKey: 'medical_asthma_details',
        type: 'text',
        order: 10
      },
      {
        id: uuidv4(),
        label: 'Have you ever been diagnosed or received treatment for Cancer or Tumor?',
        dataKey: 'medical_cancer',
        type: 'radio',
        order: 11,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, provide details for Cancer/Tumor',
        dataKey: 'medical_cancer_details',
        type: 'text',
        order: 12
      },
      {
        id: uuidv4(),
        label: 'Have you ever been diagnosed or received treatment for Kidney Disease?',
        dataKey: 'medical_kidneyDisease',
        type: 'radio',
        order: 13,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, provide details for Kidney Disease',
        dataKey: 'medical_kidneyDisease_details',
        type: 'text',
        order: 14
      },
      {
        id: uuidv4(),
        label: 'Have you ever been diagnosed or received treatment for Liver Disease?',
        dataKey: 'medical_liverDisease',
        type: 'radio',
        order: 15,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, provide details for Liver Disease',
        dataKey: 'medical_liverDisease_details',
        type: 'text',
        order: 16
      },
      {
        id: uuidv4(),
        label: 'Have you ever been diagnosed or received treatment for Thyroid Disorder?',
        dataKey: 'medical_thyroid',
        type: 'radio',
        order: 17,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, provide details for Thyroid Disorder',
        dataKey: 'medical_thyroid_details',
        type: 'text',
        order: 18
      },
      {
        id: uuidv4(),
        label: 'Have you ever been diagnosed or received treatment for Mental/Psychiatric Disorder?',
        dataKey: 'medical_psychiatric',
        type: 'radio',
        order: 19,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, provide details for Mental/Psychiatric Disorder',
        dataKey: 'medical_psychiatric_details',
        type: 'text',
        order: 20
      },
      {
        id: uuidv4(),
        label: 'Have you ever had any Surgery or Hospitalization?',
        dataKey: 'medical_surgery',
        type: 'radio',
        order: 21,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, provide details of Surgery/Hospitalization',
        dataKey: 'medical_surgery_details',
        type: 'text',
        order: 22,
        placeholder: 'Include date, type of surgery, hospital name'
      },
      {
        id: uuidv4(),
        label: 'Are you currently on any medication?',
        dataKey: 'medical_currentMedication',
        type: 'radio',
        order: 23,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, provide medication details',
        dataKey: 'medical_currentMedication_details',
        type: 'text',
        order: 24,
        placeholder: 'List all medications with dosage and reason'
      },
      {
        id: uuidv4(),
        label: 'Have you been advised to undergo any medical tests or treatment in the future?',
        dataKey: 'medical_futureTests',
        type: 'radio',
        order: 25,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, provide details of future tests/treatment',
        dataKey: 'medical_futureTests_details',
        type: 'text',
        order: 26
      },
      {
        id: uuidv4(),
        label: 'Do you have any physical disability or deformity?',
        dataKey: 'medical_disability',
        type: 'radio',
        order: 27,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, provide details of disability',
        dataKey: 'medical_disability_details',
        type: 'text',
        order: 28
      }
    ]
  }, */
  // COMMENTED OUT: Maternity Declaration - Not needed for simplified form
  /* {
    id: uuidv4(),
    title: 'Maternity Declaration (For Female Applicants)',
    order: 6,
    questions: [
      {
        id: uuidv4(),
        label: 'Are you currently pregnant?',
        dataKey: 'maternity_currentlyPregnant',
        type: 'radio',
        order: 1,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ],
        helperText: 'For female applicants only'
      },
      {
        id: uuidv4(),
        label: 'If yes, how many weeks pregnant?',
        dataKey: 'maternity_weeksPregnant',
        type: 'number',
        order: 2,
        placeholder: 'Number of weeks'
      },
      {
        id: uuidv4(),
        label: 'Expected delivery date',
        dataKey: 'maternity_expectedDelivery',
        type: 'date',
        order: 3
      },
      {
        id: uuidv4(),
        label: 'Is it a multiple pregnancy (twins, triplets)?',
        dataKey: 'maternity_multiplePregnancy',
        type: 'radio',
        order: 4,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'Any complications in current pregnancy?',
        dataKey: 'maternity_complications',
        type: 'radio',
        order: 5,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'If yes, provide details of complications',
        dataKey: 'maternity_complications_details',
        type: 'text',
        order: 6
      },
      {
        id: uuidv4(),
        label: 'Previous pregnancies - Number of live births',
        dataKey: 'maternity_liveBirths',
        type: 'number',
        order: 7
      },
      {
        id: uuidv4(),
        label: 'Previous pregnancies - Number of miscarriages',
        dataKey: 'maternity_miscarriages',
        type: 'number',
        order: 8
      },
      {
        id: uuidv4(),
        label: 'Previous pregnancies - Any complications?',
        dataKey: 'maternity_prevComplications',
        type: 'radio',
        order: 9,
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      },
      {
        id: uuidv4(),
        label: 'If yes, provide details of previous pregnancy complications',
        dataKey: 'maternity_prevComplications_details',
        type: 'text',
        order: 10
      }
    ]
  } */
];

export const alSagrDocumentRequirements: DocumentRequirement[] = [
  {
    id: uuidv4(),
    documentType: 'passport',
    label: 'Copy of Passport',
    description: 'Clear copy of passport showing personal details',
    required: true,
    acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
    maxSizeInMB: 5
  },
  {
    id: uuidv4(),
    documentType: 'emirates_id',
    label: 'Copy of Emirates ID Card',
    description: 'Front and back copy of valid Emirates ID',
    required: true,
    acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
    maxSizeInMB: 5
  },
  {
    id: uuidv4(),
    documentType: 'visa',
    label: 'Copy of Visa',
    description: 'Valid UAE visa copy',
    required: true,
    acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
    maxSizeInMB: 5
  },
  {
    id: uuidv4(),
    documentType: 'signed_pdf',
    label: 'Signed Application Form',
    description: 'Manually signed medical application form PDF',
    required: true,
    acceptedFormats: ['pdf'],
    maxSizeInMB: 10
  }
];

// Helper to create the complete template
export function createAlSagrTemplate(vendorId: string, vendorName: string, vendorCode: string, createdBy: string) {
  return {
    vendorId,
    vendorCode,
    vendorName,
    lineOfBusiness: 'medical',
    name: 'Medical Application Form - Al Sagr National Insurance',
    description: 'Comprehensive medical application form for individual and family health insurance coverage',
    sections: alSagrTemplateSections,
    requiredDocuments: alSagrDocumentRequirements,
    status: 'draft' as const,
    version: 1,
    createdBy,
    updatedBy: createdBy,
    isDeleted: false,
    pdfFieldMappings: [] // Will be configured later through mapping UI
  };
}
