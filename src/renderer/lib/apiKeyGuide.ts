export const API_KEY_UPDATED_EVENT = 'edunote:api-key-updated';

export const GEMINI_API_GUIDE_STEPS = [
  'aistudio.google.com에서 프로젝트를 만들어 API 키를 발급합니다.',
  '왼쪽 메뉴에서 API 키를 선택합니다.',
  '프로젝트가 없다면 프로젝트 → 프로젝트 만들기 → 프로젝트 이름을 edunote로 입력 → 프로젝트 만들기를 누릅니다.',
  '프로젝트 가져오기(Select a Cloud Project)에서 방금 만든 edunote 프로젝트를 선택합니다.',
  '키 만들기를 누릅니다.',
  '다시 API 키 화면에서 생성된 API 키를 복사합니다.',
  'EduNote에 붙여넣고 키 테스트 후 저장합니다.',
];

export const GEMINI_API_CLOUD_FALLBACK_STEPS = [
  'console.cloud.google.com에서 Google Cloud에 접속합니다.',
  '상단 프로젝트 선택에서 새 프로젝트를 만들고 프로젝트 이름을 edunote로 입력합니다.',
  '검색창에서 Generative Language API를 찾아 사용 설정합니다.',
  'API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → API 키를 선택합니다.',
  '생성된 API 키를 복사해 EduNote에 붙여넣고 키 테스트 후 저장합니다.',
];
