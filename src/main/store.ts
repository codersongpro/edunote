import Store from 'electron-store';
import { CONFIG_DEFAULTS } from './configDefaults';

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
  // safeStorage로 암호화한 값(base64). 암호화 가능 환경에서는 평문 대신 이 키에 저장한다.
  naramarketApiKeyEnc: string;
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
    naramarketApiKey: '',
    naramarketApiKeyEnc: '',
    ...CONFIG_DEFAULTS,
  },
});

// 네이버 쇼핑 검색 API가 2026년 7월 31일 종료되어 더 이상 사용하지 않는다.
// 예전 버전에서 저장한 Client ID·Secret이 남아 있으면 쓰이지도 않는 자격 증명이
// 디스크에 계속 보관되므로, 앱을 켤 때 한 번 지운다.
for (const legacyKey of ['naverShoppingClientId', 'naverShoppingClientSecret', 'naverShoppingClientSecretEnc']) {
  if (store.has(legacyKey as never)) store.delete(legacyKey as never);
}
