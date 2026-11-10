// 설정 기본값(시크릿 제외). 데스크톱 electron-store와 웹판 저장소가 같은 기본값을 쓴다.
export const CONFIG_DEFAULTS = {
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
  chatFirebaseConfig: '',
  chatActiveRoomId: '',
  chatRoomHistory: '',
  neisByteLimits: '',
} as const;
