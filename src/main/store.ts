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
  // safeStorage로 암호화한 값(base64). 암호화 가능 환경에서는 평문 대신 이 키에 저장한다.
  naramarketApiKeyEnc: string;
  naverShoppingClientSecretEnc: string;
  chatFirebaseConfig: string;
  chatActiveRoomId: string;
  chatRoomHistory: string;
  // 생기부 항목별 바이트 상한을 담은 JSON 문자열(예: {"opinion":1500,...}).
  // 기재요령이 학년도·학교급마다 달라 사용자가 조정할 수 있어야 하므로 설정으로 뺐다.
  // 빈 문자열이면 textLength.ts의 기본값을 쓴다.
  neisByteLimits: string;
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
    // 학생 개인정보가 암호화 없이 저장되는 기능이라, 사용자가 명시적으로 켜야 동작하도록
    // 기본값을 off로 둔다(v1.19.0 이전에는 weekly가 기본값이었으나, 이미 저장된 값이 있는
    // 기존 사용자에게는 이 기본값이 적용되지 않는다).
    autoBackupInterval: 'off',
    lastAutoBackupAt: '',
    naramarketApiKey: '',
    naverShoppingClientId: '',
    naverShoppingClientSecret: '',
    naramarketApiKeyEnc: '',
    naverShoppingClientSecretEnc: '',
    chatFirebaseConfig: '',
    chatActiveRoomId: '',
    chatRoomHistory: '',
    neisByteLimits: '',
  },
});
