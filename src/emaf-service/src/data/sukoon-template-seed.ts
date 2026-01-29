/**
 * Sukoon EMAF Template Seed Data
 * Based on Sukoon Insurance Medical Application Form
 */

import { FormSection, FormQuestion, DocumentRequirement } from '../models/emafTypes';
import { v4 as uuidv4 } from 'uuid';

export const sukoonTemplateSections: FormSection[] = [
  // Section 1: Member Details
  {
    id: uuidv4(),
    title: 'Member Details',
    order: 1,
    questions: [
      {
        id: uuidv4(),
        label: 'Applicant\'s Name',
        dataKey: 'memberDetails.applicantName',
        type: 'text',
        order: 1,
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Relationship with the proposed insured',
        dataKey: 'memberDetails.relationship',
        type: 'dropdown',
        order: 2,
        options: [
          { label: 'Self', value: 'Self' },
          { label: 'Spouse', value: 'Spouse' },
          { label: 'Child', value: 'Child' },
          { label: 'Parent', value: 'Parent' },
          { label: 'Other', value: 'Other' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Address',
        dataKey: 'memberDetails.address',
        type: 'text',
        order: 3,
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'P.O. Box',
        dataKey: 'memberDetails.poBox',
        type: 'text',
        order: 4
      },
      {
        id: uuidv4(),
        label: 'Email address',
        dataKey: 'memberDetails.email',
        type: 'email',
        order: 5,
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Contact Number',
        dataKey: 'memberDetails.contactNumber',
        type: 'phone',
        order: 6,
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Emirates ID',
        dataKey: 'memberDetails.emiratesId',
        type: 'text',
        order: 7,
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Occupation',
        dataKey: 'memberDetails.occupation',
        type: 'text',
        order: 8
      },
      {
        id: uuidv4(),
        label: 'Sponsor\'s Name',
        dataKey: 'memberDetails.sponsorName',
        type: 'text',
        order: 9
      },
      {
        id: uuidv4(),
        label: 'Salary (AED)',
        dataKey: 'memberDetails.salary',
        type: 'radio',
        order: 10,
        options: [
          { label: 'Up to 4,000', value: 'up_to_4000' },
          { label: 'Above 4,000', value: 'above_4000' }
        ],
        validation: { required: true }
      }
    ]
  },
  // Section 2: Previous Insurance
  {
    id: uuidv4(),
    title: 'Details of Existing or Previous Insurance',
    order: 2,
    questions: [
      {
        id: uuidv4(),
        label: 'Do you have existing or previous health insurance with Sukoon Insurance PJSC or existing valid health insurance with any other insurer in the UAE?',
        dataKey: 'previousInsurance.hasInsurance',
        type: 'radio',
        order: 1,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'If yes, please provide details (Policy number), expiry date',
        dataKey: 'previousInsurance.policyNumber',
        type: 'text',
        order: 2
      },
      {
        id: uuidv4(),
        label: 'Expiry Date',
        dataKey: 'previousInsurance.expiryDate',
        type: 'date',
        order: 3
      }
    ]
  },
  // Section 3: Members to be Insured
  {
    id: uuidv4(),
    title: 'Details of Members to be insured (Self, Spouse & Children)',
    order: 3,
    questions: [
      {
        id: uuidv4(),
        label: 'Member Name',
        dataKey: 'members[].name',
        type: 'text',
        order: 1,
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Nationality',
        dataKey: 'members[].nationality',
        type: 'text',
        order: 2,
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Passport/Emirates ID Number',
        dataKey: 'members[].passportOrEmiratesId',
        type: 'text',
        order: 3,
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Relationship',
        dataKey: 'members[].relationship',
        type: 'dropdown',
        order: 4,
        options: [
          { label: 'Self', value: 'Self' },
          { label: 'Spouse', value: 'Spouse' },
          { label: 'Child', value: 'Child' },
          { label: 'Parent', value: 'Parent' },
          { label: 'Other', value: 'Other' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Marital Status',
        dataKey: 'members[].maritalStatus',
        type: 'dropdown',
        order: 5,
        options: [
          { label: 'Single', value: 'Single' },
          { label: 'Married', value: 'Married' },
          { label: 'Divorced', value: 'Divorced' },
          { label: 'Widowed', value: 'Widowed' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Date of Birth',
        dataKey: 'members[].dateOfBirth',
        type: 'date',
        order: 6,
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Gender',
        dataKey: 'members[].gender',
        type: 'radio',
        order: 7,
        options: [
          { label: 'Male', value: 'Male' },
          { label: 'Female', value: 'Female' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Height',
        dataKey: 'members[].height',
        type: 'text',
        order: 8
      },
      {
        id: uuidv4(),
        label: 'Weight',
        dataKey: 'members[].weight',
        type: 'text',
        order: 9
      },
      {
        id: uuidv4(),
        label: 'Visa Emirate',
        dataKey: 'members[].visaEmirate',
        type: 'dropdown',
        order: 10,
        options: [
          { label: 'Abu Dhabi', value: 'Abu Dhabi' },
          { label: 'Dubai', value: 'Dubai' },
          { label: 'Sharjah', value: 'Sharjah' },
          { label: 'Ajman', value: 'Ajman' },
          { label: 'Umm Al Quwain', value: 'Umm Al Quwain' },
          { label: 'Ras Al Khaimah', value: 'Ras Al Khaimah' },
          { label: 'Fujairah', value: 'Fujairah' }
        ],
        validation: { required: true }
      }
    ]
  },
  // Section 4: Medical History
  {
    id: uuidv4(),
    title: 'Medical History',
    order: 4,
    questions: [
      // Question 1
      {
        id: uuidv4(),
        label: 'Have you ever been diagnosed or investigated for a medical condition requiring regular outpatient treatment, follow – ups or specialized investigations (Ultrasound/MRI/CT scan) or inpatient treatment/hospitalization? If yes, please specify condition/s and attach applicable test results:',
        dataKey: 'medicalHistory.question1.hasCondition',
        type: 'radio',
        order: 1,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Have you been diagnosed for High blood sugar (Diabetes mellitus)?',
        dataKey: 'medicalHistory.question1.diabetes.has',
        type: 'radio',
        order: 2,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
      },
      {
        id: uuidv4(),
        label: 'Are you taking Insulin (Diabetes Mellitus type 1)?',
        dataKey: 'medicalHistory.question1.diabetes.takingInsulin',
        type: 'radio',
        order: 3,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
      },
      {
        id: uuidv4(),
        label: 'Have you been diagnosed or investigated for diminished vision (retinopathy), kidney impairment (nephropathy) or numbness of limbs (neuropathy) or advised for hospitalization?',
        dataKey: 'medicalHistory.question1.diabetes.hasComplications',
        type: 'radio',
        order: 4,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
      },
      {
        id: uuidv4(),
        label: 'Have you been diagnosed with High blood pressure (Hypertension) and/ or abnormal lipid profile (Dyslipidemia/ Hyperlipidemia)?',
        dataKey: 'medicalHistory.question1.hypertension.has',
        type: 'radio',
        order: 5,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
      },
      {
        id: uuidv4(),
        label: 'Have you been investigated or diagnosed for chest pain (angina pectoris) or any heart disease (coronary artery/ ischemic heart disease, cardiomyopathy, or heart valve incompetence)?',
        dataKey: 'medicalHistory.question1.hypertension.heartDiseaseInvestigated',
        type: 'radio',
        order: 6,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
      },
      {
        id: uuidv4(),
        label: 'Have you been diagnosed with disease or disorder of Thyroid Gland with or without abnormal thyroid function tests (Hypothyroidism, Hyperthyroidism)?',
        dataKey: 'medicalHistory.question1.thyroid.has',
        type: 'radio',
        order: 7,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
      },
      {
        id: uuidv4(),
        label: 'Do you have Enlarge thyroid (Thyroid nodule, Multinodular Goiter) with or without past history of surgical treatment or Needle Biopsy?',
        dataKey: 'medicalHistory.question1.thyroid.enlargedThyroid',
        type: 'radio',
        order: 8,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
      },
      {
        id: uuidv4(),
        label: 'Have you been diagnosed with Hyperthyroidism, Thyroiditis or Graves\' disease with or without past history of surgical treatment or Needle Biopsy?',
        dataKey: 'medicalHistory.question1.thyroid.hyperthyroidism',
        type: 'radio',
        order: 9,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
      },
      {
        id: uuidv4(),
        label: 'Have you been diagnosed for Breathlessness or experienced whistling sound on breathing (Asthma)?',
        dataKey: 'medicalHistory.question1.asthma.has',
        type: 'radio',
        order: 10,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
      },
      {
        id: uuidv4(),
        label: 'Have you visited to an emergency room or hospitalized for treatment of Asthma?',
        dataKey: 'medicalHistory.question1.asthma.emergencyVisit',
        type: 'radio',
        order: 11,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
      },
      {
        id: uuidv4(),
        label: 'Do you have any other medical conditions, Physical or mental disorder/disability not listed above?',
        dataKey: 'medicalHistory.question1.otherConditions',
        type: 'radio',
        order: 12,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
      },
      // Question 2
      {
        id: uuidv4(),
        label: 'Are you currently Pregnant?',
        dataKey: 'medicalHistory.question2.isPregnant',
        type: 'radio',
        order: 13,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Is your pregnancy single or multiple (twin, triplet etc.)',
        dataKey: 'medicalHistory.question2.pregnancyType',
        type: 'radio',
        order: 14,
        options: [
          { label: 'Single', value: 'single' },
          { label: 'Multiple', value: 'multiple' }
        ],
      },
      {
        id: uuidv4(),
        label: 'Are there any pregnancy complications (Fetal Growth Retardation or Congenital anomaly etc.)?',
        dataKey: 'medicalHistory.question2.hasComplications',
        type: 'radio',
        order: 15,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
      },
      {
        id: uuidv4(),
        label: 'Expected date of delivery',
        dataKey: 'medicalHistory.question2.expectedDeliveryDate',
        type: 'date',
        order: 16,
      },
      {
        id: uuidv4(),
        label: 'Are you currently trying to get pregnant?',
        dataKey: 'medicalHistory.question2.tryingToGetPregnant',
        type: 'radio',
        order: 17,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
      },
      {
        id: uuidv4(),
        label: 'Are you undergoing any form of fertility treatment?',
        dataKey: 'medicalHistory.question2.fertilityTreatment',
        type: 'radio',
        order: 18,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
      },
      {
        id: uuidv4(),
        label: 'Input Last two Menstrual Dates',
        dataKey: 'medicalHistory.question2.lastMenstrualDate1',
        type: 'date',
        order: 19,
      },
      {
        id: uuidv4(),
        label: 'Last Menstrual Date 2',
        dataKey: 'medicalHistory.question2.lastMenstrualDate2',
        type: 'date',
        order: 20,
      },
      // Question 3
      {
        id: uuidv4(),
        label: 'Have you ever been treated or diagnosed with Lump/Cyst/Cancer/Tumor?',
        dataKey: 'medicalHistory.question3.hasLumpCystCancer',
        type: 'radio',
        order: 21,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
        validation: { required: true }
      },
      // Question 4
      {
        id: uuidv4(),
        label: 'Have you undergone surgery or advised a surgery or currently hospitalized or requiring daycare or inpatient treatment?',
        dataKey: 'medicalHistory.question4.hasSurgery',
        type: 'radio',
        order: 22,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
        validation: { required: true }
      },
      // Question 5
      {
        id: uuidv4(),
        label: 'Do you have any sign, symptom, sickness requiring treatment or medications or have been advised to take any medication or treatment for more than 07 days or are you currently taking any medication?',
        dataKey: 'medicalHistory.question5.hasMedications',
        type: 'radio',
        order: 23,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
        validation: { required: true }
      },
      // Question 6
      {
        id: uuidv4(),
        label: 'Have you visited clinics/ hospitals for assessment, Physiotherapy & treatment for back pain (e.g., Neck Pain, Low Back Pain, etc.)?',
        dataKey: 'medicalHistory.question6.hasBackPain',
        type: 'radio',
        order: 24,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ],
        validation: { required: true }
      }
    ]
  },
  // Section 5: Specific Medical History (36 conditions)
  {
    id: uuidv4(),
    title: 'Specific Medical History',
    order: 5,
    questions: [
      {
        id: uuidv4(),
        label: 'Birth Malformation, congenital condition, Developmental disorder',
        dataKey: 'specificMedicalHistory.condition1',
        type: 'checkbox',
        order: 1
      },
      {
        id: uuidv4(),
        label: 'Blood disease (Anemia, Leukemia, Polycythemia, Thrombocytopenia)',
        dataKey: 'specificMedicalHistory.condition2',
        type: 'checkbox',
        order: 2
      },
      {
        id: uuidv4(),
        label: 'Chronic Obstructive Pulmonary Disease Chronic bronchitis, Bronchiectasis)',
        dataKey: 'specificMedicalHistory.condition3',
        type: 'checkbox',
        order: 3
      },
      {
        id: uuidv4(),
        label: 'Chronic Kidney disease, Renal impairment/ Failure',
        dataKey: 'specificMedicalHistory.condition4',
        type: 'checkbox',
        order: 4
      },
      {
        id: uuidv4(),
        label: 'Bipolar Disorder',
        dataKey: 'specificMedicalHistory.condition5',
        type: 'checkbox',
        order: 5
      },
      {
        id: uuidv4(),
        label: 'Chronic liver disease, Cirrhosis of liver',
        dataKey: 'specificMedicalHistory.condition6',
        type: 'checkbox',
        order: 6
      },
      {
        id: uuidv4(),
        label: 'Cerebrovascular Stroke (CVA)',
        dataKey: 'specificMedicalHistory.condition7',
        type: 'checkbox',
        order: 7
      },
      {
        id: uuidv4(),
        label: 'Cataract',
        dataKey: 'specificMedicalHistory.condition8',
        type: 'checkbox',
        order: 8
      },
      {
        id: uuidv4(),
        label: 'Communicable Disease',
        dataKey: 'specificMedicalHistory.condition9',
        type: 'checkbox',
        order: 9
      },
      {
        id: uuidv4(),
        label: 'Crohn\'s disease',
        dataKey: 'specificMedicalHistory.condition10',
        type: 'checkbox',
        order: 10
      },
      {
        id: uuidv4(),
        label: 'Diverticulosis of intestine',
        dataKey: 'specificMedicalHistory.condition11',
        type: 'checkbox',
        order: 11
      },
      {
        id: uuidv4(),
        label: 'Cystic Fibrosis',
        dataKey: 'specificMedicalHistory.condition12',
        type: 'checkbox',
        order: 12
      },
      {
        id: uuidv4(),
        label: 'Enlarge tonsils or adenoids',
        dataKey: 'specificMedicalHistory.condition13',
        type: 'checkbox',
        order: 13
      },
      {
        id: uuidv4(),
        label: 'Head Injury',
        dataKey: 'specificMedicalHistory.condition14',
        type: 'checkbox',
        order: 14
      },
      {
        id: uuidv4(),
        label: 'Hemorrhoids, Piles',
        dataKey: 'specificMedicalHistory.condition15',
        type: 'checkbox',
        order: 15
      },
      {
        id: uuidv4(),
        label: 'Heart Disease or Heart Failure',
        dataKey: 'specificMedicalHistory.condition16',
        type: 'checkbox',
        order: 16
      },
      {
        id: uuidv4(),
        label: 'Hypersplenism',
        dataKey: 'specificMedicalHistory.condition17',
        type: 'checkbox',
        order: 17
      },
      {
        id: uuidv4(),
        label: 'Hernia (Inguinal, umbilical, incisional)',
        dataKey: 'specificMedicalHistory.condition18',
        type: 'checkbox',
        order: 18
      },
      {
        id: uuidv4(),
        label: 'Immunodeficiency state specified',
        dataKey: 'specificMedicalHistory.condition19',
        type: 'checkbox',
        order: 19
      },
      {
        id: uuidv4(),
        label: 'Kidney or Gall bladder stone',
        dataKey: 'specificMedicalHistory.condition20',
        type: 'checkbox',
        order: 20
      },
      {
        id: uuidv4(),
        label: 'Myasthenia Gravis',
        dataKey: 'specificMedicalHistory.condition21',
        type: 'checkbox',
        order: 21
      },
      {
        id: uuidv4(),
        label: 'Motor neuron disease',
        dataKey: 'specificMedicalHistory.condition22',
        type: 'checkbox',
        order: 22
      },
      {
        id: uuidv4(),
        label: 'Optic Neuritis',
        dataKey: 'specificMedicalHistory.condition23',
        type: 'checkbox',
        order: 23
      },
      {
        id: uuidv4(),
        label: 'Multiple sclerosis',
        dataKey: 'specificMedicalHistory.condition24',
        type: 'checkbox',
        order: 24
      },
      {
        id: uuidv4(),
        label: 'Organ Transplant',
        dataKey: 'specificMedicalHistory.condition25',
        type: 'checkbox',
        order: 25
      },
      {
        id: uuidv4(),
        label: 'Osteoarthritis (Knee or Hip)',
        dataKey: 'specificMedicalHistory.condition26',
        type: 'checkbox',
        order: 26
      },
      {
        id: uuidv4(),
        label: 'Prostate Enlargement (Male)',
        dataKey: 'specificMedicalHistory.condition27',
        type: 'checkbox',
        order: 27
      },
      {
        id: uuidv4(),
        label: 'Pancreatitis',
        dataKey: 'specificMedicalHistory.condition28',
        type: 'checkbox',
        order: 28
      },
      {
        id: uuidv4(),
        label: 'Psoriasis',
        dataKey: 'specificMedicalHistory.condition29',
        type: 'checkbox',
        order: 29
      },
      {
        id: uuidv4(),
        label: 'Rheumatoid arthritis',
        dataKey: 'specificMedicalHistory.condition30',
        type: 'checkbox',
        order: 30
      },
      {
        id: uuidv4(),
        label: 'Retinal detachment',
        dataKey: 'specificMedicalHistory.condition31',
        type: 'checkbox',
        order: 31
      },
      {
        id: uuidv4(),
        label: 'Sinusitis, Nasal Polyp',
        dataKey: 'specificMedicalHistory.condition32',
        type: 'checkbox',
        order: 32
      },
      {
        id: uuidv4(),
        label: 'Ulcerative colitis',
        dataKey: 'specificMedicalHistory.condition33',
        type: 'checkbox',
        order: 33
      },
      {
        id: uuidv4(),
        label: 'Varicose veins of lower extremities',
        dataKey: 'specificMedicalHistory.condition34',
        type: 'checkbox',
        order: 34
      },
      {
        id: uuidv4(),
        label: 'Viral Hepatitis (B, C or Delta)',
        dataKey: 'specificMedicalHistory.condition35',
        type: 'checkbox',
        order: 35
      },
      {
        id: uuidv4(),
        label: 'Others',
        dataKey: 'specificMedicalHistory.condition36',
        type: 'checkbox',
        order: 36
      }
    ]
  },
  // Section 6: Details of YES Answers
  {
    id: uuidv4(),
    title: 'Please provide details of ALL questions which have been answered YES for Self and Dependent (s) in the below table',
    order: 6,
    questions: [
      {
        id: uuidv4(),
        label: 'Member\'s Name',
        dataKey: 'yesAnswerDetails[].memberName',
        type: 'text',
        order: 1,
      },
      {
        id: uuidv4(),
        label: 'Question No.',
        dataKey: 'yesAnswerDetails[].questionNumber',
        type: 'text',
        order: 2,
      },
      {
        id: uuidv4(),
        label: 'Medical Condition/ Type of Disorder',
        dataKey: 'yesAnswerDetails[].medicalCondition',
        type: 'text',
        order: 3,
      },
      {
        id: uuidv4(),
        label: 'Date of Onset',
        dataKey: 'yesAnswerDetails[].dateOfOnset',
        type: 'date',
        order: 4,
      },
      {
        id: uuidv4(),
        label: 'Details of Treatment',
        dataKey: 'yesAnswerDetails[].treatmentDetails',
        type: 'text',
        order: 5,
      },
      {
        id: uuidv4(),
        label: 'Name of Hospital/ Clinic',
        dataKey: 'yesAnswerDetails[].hospitalClinic',
        type: 'text',
        order: 6,
      }
    ]
  },
  // Section 7: Data Privacy Notice (read-only, no questions)
  {
    id: uuidv4(),
    title: 'Sukoon\'s Data Privacy Notice and Data Subject\'s Consent',
    order: 7,
    questions: [] // Read-only section
  },
  // Section 8: Declaration & Signature
  {
    id: uuidv4(),
    title: 'Declaration',
    order: 8,
    questions: [
      {
        id: uuidv4(),
        label: 'Applicant\'s Name',
        dataKey: 'signature.applicantName',
        type: 'text',
        order: 1,
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Date (dd/mm/yy)',
        dataKey: 'signature.date',
        type: 'date',
        order: 2,
        validation: { required: true }
      },
      {
        id: uuidv4(),
        label: 'Emirates ID Number',
        dataKey: 'signature.emiratesId',
        type: 'text',
        order: 3,
        validation: { required: true }
      }
    ]
  }
];

// Document requirements (same as ALSAGAR)
export const sukoonDocumentRequirements: DocumentRequirement[] = [
  {
    id: uuidv4(),
    documentType: 'passport',
    label: 'Copy of Passport',
    description: 'Copy of passport with valid visa page',
    required: true,
    acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
    maxSizeInMB: 10
  },
  {
    id: uuidv4(),
    documentType: 'emirates_id',
    label: 'Copy of Emirates ID',
    description: 'Copy of Emirates Identification card',
    required: true,
    acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
    maxSizeInMB: 10
  }
];
