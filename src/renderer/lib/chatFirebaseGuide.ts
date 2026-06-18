export const CHAT_FIREBASE_GUIDE_STEPS: { text: string; link?: string }[] = [
  { text: 'console.firebase.google.com에 접속해 무료 프로젝트를 만듭니다 (신용카드 등록 불필요, Spark 무료 플랜).', link: 'https://console.firebase.google.com' },
  { text: '왼쪽 메뉴에서 Firestore Database를 선택하고 데이터베이스 만들기를 누릅니다. 이때 위치(지역)는 "asia-northeast3 (서울)"로 선택하세요. 서버가 가까울수록 메시지가 빠르게 오갑니다. (지역은 한 번 만들면 바꿀 수 없으니, 미국 등으로 이미 만들었다면 새 프로젝트로 다시 만들어야 합니다.)' },
  { text: '왼쪽 메뉴 Authentication → 시작하기를 누른 뒤, Sign-in method 탭에서 "익명"을 선택해 사용 설정으로 켜고 저장합니다. (이 단계를 빠뜨리면 채팅방 개설 시 configuration-not-found 오류가 납니다.)' },
  { text: '프로젝트 설정(⚙) → 일반 → 내 앱에서 웹 앱 추가(</>) 아이콘을 누릅니다.' },
  { text: '앱 닉네임을 입력하고 앱 등록을 누르면 firebaseConfig 코드가 표시됩니다.' },
  { text: '표시된 firebaseConfig 코드 전체를 복사해 아래 입력란에 붙여넣고 저장합니다.' },
  { text: 'Firestore Database의 "규칙" 탭에 아래 보안 규칙을 복사해 붙여넣고 게시합니다.' },
];

export const CHAT_FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      function isRoomOwner() {
        return request.auth != null
               && request.auth.uid == get(/databases/$(database)/documents/rooms/$(roomId)).data.ownerUid;
      }

      // 방 코드를 정확히 아는 사람만 단건 조회 가능, 전체 목록 조회는 금지
      allow get: if true;
      allow list: if false;
      // 방 생성: 만든 사람의 익명 인증 uid를 ownerUid로 함께 저장(귓속말·종료 권한 검증에 사용)
      allow create: if request.auth != null
                    && request.resource.data.keys().hasOnly(['createdAt', 'closed', 'title', 'ownerUid'])
                    && request.resource.data.closed == false
                    && request.resource.data.title is string
                    && request.resource.data.title.size() <= 50
                    && request.resource.data.ownerUid == request.auth.uid;
      // 방 수정(종료/재시작, 공지 고정)은 방을 만든 사람만 가능, closed·pinnedMessage 값만 바꿀 수 있음
      allow update: if isRoomOwner()
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['closed', 'pinnedMessage'])
                    && request.resource.data.closed is bool
                    && (!('pinnedMessage' in request.resource.data)
                        || request.resource.data.pinnedMessage == null
                        || (request.resource.data.pinnedMessage.keys().hasOnly(['sender', 'text'])
                            && request.resource.data.pinnedMessage.sender is string
                            && request.resource.data.pinnedMessage.text is string
                            && request.resource.data.pinnedMessage.text.size() <= 500));
      // 방을 만든 사람(교사)만 방 자체를 삭제할 수 있음(지난 채팅방 목록의 "완전히 삭제" 기능에 사용)
      allow delete: if isRoomOwner();

      match /participants/{participantId} {
        // 방에 들어온 사람 목록(닉네임만 저장). 본인 문서만 만들고 갱신할 수 있음
        allow read: if true;
        allow create: if request.auth != null && request.auth.uid == participantId
                      && request.resource.data.keys().hasOnly(['nickname', 'joinedAt', 'lastSeen'])
                      && request.resource.data.nickname is string
                      && request.resource.data.nickname.size() <= 20;
        // 접속 유지 신호(lastSeen)만 본인이 갱신 가능, 닉네임은 이후 변경 불가
        allow update: if request.auth != null && request.auth.uid == participantId
                      && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['lastSeen']);
        // 본인이거나, 방을 만든 사람(교사)이 방을 통째로 삭제할 때 함께 지울 수 있음
        allow delete: if (request.auth != null && request.auth.uid == participantId) || isRoomOwner();
      }

      match /messages/{messageId} {
        // 공개 메시지(to == null)는 누구나 읽을 수 있고, 귓속말(to, 받는 사람들의 uid 배열)은
        // 그 배열에 포함된 사람들과 방 주인(교사)만 읽을 수 있음.
        // (to를 생략하지 않고 항상 null 또는 배열로 써야, 학생 쪽의 where('to','==',null) /
        //  where('to','array-contains',uid) 쿼리가 규칙과 정확히 맞아 거부되지 않는다.)
        allow read: if resource.data.to == null
                    || (request.auth != null && request.auth.uid in resource.data.to)
                    || isRoomOwner();
        allow create: if request.auth != null
                      && request.resource.data.keys().hasOnly(['sender', 'text', 'createdAt', 'senderUid', 'to'])
                      && request.resource.data.senderUid == request.auth.uid
                      && request.resource.data.sender is string
                      && request.resource.data.sender.size() <= 30
                      && request.resource.data.text is string
                      && request.resource.data.text.size() > 0
                      && request.resource.data.text.size() <= 500
                      && (request.resource.data.to == null
                          || (request.resource.data.to is list
                              && request.resource.data.to.size() > 0
                              && request.resource.data.to.size() <= 50
                              && isRoomOwner()));
        allow update: if false;
        // 방을 만든 사람(교사)만 메시지를 지울 수 있음(방 전체 삭제 시 함께 지움)
        allow delete: if isRoomOwner();
      }
    }
  }
}`;

export const CHAT_STUDENT_PAGE_URL = 'https://codersongpro.github.io/edunote/chat/';
