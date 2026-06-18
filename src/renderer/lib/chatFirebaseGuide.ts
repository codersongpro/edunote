export const CHAT_FIREBASE_GUIDE_STEPS = [
  'console.firebase.google.com에 접속해 무료 프로젝트를 만듭니다 (신용카드 등록 불필요, Spark 무료 플랜).',
  '왼쪽 메뉴에서 Firestore Database를 선택하고 데이터베이스 만들기를 누릅니다.',
  '왼쪽 메뉴에서 Storage를 선택하고 시작하기를 눌러 만듭니다.',
  '프로젝트 설정(⚙) → 일반 → 내 앱에서 웹 앱 추가(</>) 아이콘을 누릅니다.',
  '앱 닉네임을 입력하고 앱 등록을 누르면 firebaseConfig 코드가 표시됩니다.',
  '표시된 firebaseConfig 코드 전체를 복사해 아래 입력란에 붙여넣고 저장합니다.',
  'Firestore Database와 Storage의 "규칙" 탭에 아래 보안 규칙을 각각 복사해 붙여넣고 게시합니다.',
];

export const CHAT_FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} { allow read, write: if true; }
    match /rooms/{roomId}/messages/{messageId} { allow read, create: if true; }
  }
}`;

export const CHAT_STORAGE_RULES = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /rooms/{roomId}/{allPaths=**} {
      allow read, write: if request.resource.size < 20 * 1024 * 1024;
    }
  }
}`;

export const CHAT_STUDENT_PAGE_URL = 'https://codersongpro.github.io/edunote/chat/';
