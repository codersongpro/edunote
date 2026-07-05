import Store from 'electron-store';

interface StoreSchema {
  geminiApiKey: string;
  geminiPaidApiKey: string;
  // safeStorage로 암호화한 API 키(base64). 암호화 가능 환경에서는 평문 대신 이 키에 저장한다.
  geminiApiKeyEnc: string;
  geminiPaidApiKeyEnc: string;
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
  autoBackupInterval: 'off' | 'daily' | 'weekly';
  lastAutoBackupAt: string;
  naramarketApiKey: string;
  naverShoppingClientId: string;
  naverShoppingClientSecret: string;
  chatFirebaseConfig: string;
  chatActiveRoomId: string;
  chatRoomHistory: string;
}

export const store = new Store<StoreSchema>({
  defaults: {
    geminiApiKey: '',
    geminiPaidApiKey: '',
    geminiApiKeyEnc: '',
    geminiPaidApiKeyEnc: '',
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
    autoBackupInterval: 'weekly',
    lastAutoBackupAt: '',
    naramarketApiKey: '',
    naverShoppingClientId: '',
    naverShoppingClientSecret: '',
    chatFirebaseConfig: '',
    chatActiveRoomId: '',
    chatRoomHistory: '',
  },
});
