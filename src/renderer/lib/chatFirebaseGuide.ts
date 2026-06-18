export const CHAT_FIREBASE_GUIDE_STEPS: { text: string; link?: string }[] = [
  { text: 'console.firebase.google.com에 접속해 무료 프로젝트를 만듭니다 (신용카드 등록 불필요, Spark 무료 플랜).', link: 'https://console.firebase.google.com' },
  { text: '왼쪽 메뉴에서 Firestore Database를 선택하고 데이터베이스 만들기를 누릅니다.' },
  { text: '프로젝트 설정(⚙) → 일반 → 내 앱에서 웹 앱 추가(</>) 아이콘을 누릅니다.' },
  { text: '앱 닉네임을 입력하고 앱 등록을 누르면 firebaseConfig 코드가 표시됩니다.' },
  { text: '표시된 firebaseConfig 코드 전체를 복사해 아래 입력란에 붙여넣고 저장합니다.' },
  { text: 'Firestore Database의 "규칙" 탭에 아래 보안 규칙을 복사해 붙여넣고 게시합니다.' },
];

export const CHAT_FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      // 방 코드를 정확히 아는 사람만 단건 조회 가능, 전체 목록 조회는 금지
      allow get: if true;
      allow list: if false;
      // 방 생성: 필요한 필드만 허용하고 형식을 검증
      allow create: if request.resource.data.keys().hasOnly(['createdAt', 'closed', 'title'])
                    && request.resource.data.closed == false
                    && request.resource.data.title is string
                    && request.resource.data.title.size() <= 50;
      // 방 수정: closed 값만 바꿀 수 있음(제목·생성시각 변조 방지)
      allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['closed'])
                    && request.resource.data.closed is bool;
      allow delete: if false;

      match /messages/{messageId} {
        // 방 코드를 알아야만 이 경로에 도달할 수 있음
        allow read: if true;
        allow create: if request.resource.data.keys().hasOnly(['sender', 'text', 'createdAt'])
                      && request.resource.data.sender is string
                      && request.resource.data.sender.size() <= 30
                      && request.resource.data.text is string
                      && request.resource.data.text.size() > 0
                      && request.resource.data.text.size() <= 500;
        allow update, delete: if false;
      }
    }
  }
}`;

export const CHAT_STUDENT_PAGE_URL = 'https://codersongpro.github.io/edunote/chat/';
