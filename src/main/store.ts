import Store from 'electron-store';

interface StoreSchema {
  geminiApiKey: string;
  geminiPaidApiKey: string;
  apiTier: 'free' | 'paid';
  appDataDir: string;
  saveDir: string;
  alwaysAskPath: boolean;
  teacherName: string;
  schoolName: string;
  institution: string;
  schoolLevel: string;
  gradeClass: string;
  studentNames: string;
  studentMaleNames: string;
  studentFemaleNames: string;
  darkMode: boolean;
  apiKeyLastUsable: boolean;
  onboardingDismissed: boolean;
  privacyModeEnabled: boolean;
  reviewChecklistEnabled: boolean;
  cautionTerms: string;
  lastBackupAt: string;
  naramarketApiKey: string;
  naverShoppingClientId: string;
  naverShoppingClientSecret: string;
}

export const store = new Store<StoreSchema>({
  defaults: {
    geminiApiKey: '',
    geminiPaidApiKey: '',
    apiTier: 'free',
    appDataDir: '',
    saveDir: '',
    alwaysAskPath: true,
    teacherName: '',
    schoolName: '',
    institution: '',
    schoolLevel: '고등학교',
    gradeClass: '',
    studentNames: '',
    studentMaleNames: '',
    studentFemaleNames: '',
    darkMode: false,
    apiKeyLastUsable: false,
    onboardingDismissed: false,
    privacyModeEnabled: true,
    reviewChecklistEnabled: true,
    cautionTerms: '성실함\n우수함\n대회\n수상\n자격증\n모의고사',
    lastBackupAt: '',
    naramarketApiKey: '',
    naverShoppingClientId: '',
    naverShoppingClientSecret: '',
  },
});
