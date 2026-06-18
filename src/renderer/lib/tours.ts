// 메뉴별 인터랙티브 튜토리얼(실시간 오버레이) 정의.
// 각 step의 selector는 화면 요소에 붙인 data-tour 속성을 가리킨다.
// 새 메뉴를 추가하려면 이 객체에 항목을 더하고, 해당 화면 요소에 data-tour 속성만 달면 된다.

export type TourStep = {
  selector: string; // 하이라이트할 대상 요소 선택자 (예: '[data-tour="school-doc-input"]')
  title: string;
  body: string;
  placement?: 'top' | 'bottom' | 'left' | 'right'; // 말풍선 위치 (기본 bottom)
};

export type Tour = {
  id: string;
  title: string;
  steps: TourStep[];
};

export const TOURS: Record<string, Tour> = {
  'school-doc': {
    id: 'school-doc',
    title: '문서작성기 사용법',
    steps: [
      {
        selector: '[data-tour="school-doc-input"]',
        title: '1. 문서 정보 입력',
        body: '상단 탭에서 만들 문서 종류(공문서·가정통신문 등)를 고른 뒤, 이곳에 제목과 내용을 입력합니다.',
        placement: 'right',
      },
      {
        selector: '[data-tour="school-doc-generate"]',
        title: '2. 문서 생성',
        body: '입력을 마치면 이 버튼을 눌러 AI가 문서 초안을 작성하게 합니다.',
        placement: 'top',
      },
      {
        selector: '[data-tour="school-doc-output"]',
        title: '3. 확인·번역·저장',
        body: '작성된 문서는 여기에서 직접 수정할 수 있습니다. 가정통신문·메세지는 번역도 할 수 있고, PDF·HWPX 등으로 저장합니다.',
        placement: 'left',
      },
    ],
  },
  'lesson-material': {
    id: 'lesson-material',
    title: '수업자료 생성 사용법',
    steps: [
      {
        selector: '[data-tour="lesson-input"]',
        title: '1. 수업 정보 입력',
        body: '교과·단원·주제와 추가 요청사항을 입력합니다. 프레젠테이션과 활동지 중 원하는 형식을 고를 수 있습니다.',
        placement: 'right',
      },
      {
        selector: '[data-tour="lesson-generate"]',
        title: '2. 자료 생성',
        body: '이 버튼을 누르면 입력한 내용으로 수업 자료를 만들어 줍니다.',
        placement: 'top',
      },
      {
        selector: '[data-tour="lesson-output"]',
        title: '3. 확인·저장',
        body: '생성된 슬라이드·활동지는 여기에서 확인하고 PDF 등으로 저장할 수 있습니다.',
        placement: 'left',
      },
    ],
  },
  'budget-planner': {
    id: 'budget-planner',
    title: '예산안작성 사용법',
    steps: [
      {
        selector: '[data-tour="budget-input"]',
        title: '1. 예산 정보 입력',
        body: '예산 제목과 총액, 작성 방식(과목별 비율·일반 작성)을 정하고 희망 물품을 입력합니다.',
        placement: 'right',
      },
      {
        selector: '[data-tour="budget-generate"]',
        title: '2. 예산안 생성',
        body: '이 버튼을 누르면 품목과 금액이 채워진 예산안을 만들어 줍니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="budget-output"]',
        title: '3. 0원 맞추기·저장',
        body: '생성된 예산안에서 수량을 조정하고 "0원 맞추기"로 잔액을 맞춘 뒤 저장할 수 있습니다.',
        placement: 'left',
      },
    ],
  },
  'record-chatbot': {
    id: 'record-chatbot',
    title: '학생기록AI 챗봇 사용법',
    steps: [
      {
        selector: '[data-tour="record-chatbot-header"]',
        title: '1. 학생기록AI 챗봇',
        body: '2026 학교생활기록부 기재요령을 바탕으로 생기부 작성을 도와드립니다. 기재 예시 요청, 금지 사항 확인 등을 물어보세요.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="record-chatbot-suggestions"]',
        title: '2. 자주 묻는 질문',
        body: '버튼을 클릭하면 자주 쓰는 질문의 답변을 바로 볼 수 있습니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="record-chatbot-input"]',
        title: '3. 질문 입력',
        body: '궁금한 사항을 자유롭게 입력하고 전송 버튼을 누르세요.',
        placement: 'top',
      },
      {
        selector: '[data-tour="record-chatbot-messages"]',
        title: '4. AI 답변 확인',
        body: 'AI의 답변이 여기에 표시됩니다. 스크롤하여 이전 대화 이력을 볼 수 있고, 초기화 버튼으로 새 대화를 시작합니다.',
        placement: 'bottom',
      },
    ],
  },
  'education-qa': {
    id: 'education-qa',
    title: '교무행정AI 챗봇 사용법',
    steps: [
      {
        selector: '[data-tour="education-qa-header"]',
        title: '1. 교무행정AI 챗봇',
        body: '교육 정책, 교육과정, 교수법, 평가 방법, 학교 행정 등 교육 전반에 관한 질문을 자유롭게 해주세요.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="education-qa-suggestions"]',
        title: '2. 자주 묻는 질문',
        body: '버튼을 클릭하면 교육 관련 자주 묻는 질문의 답변을 바로 볼 수 있습니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="education-qa-input"]',
        title: '3. 질문 입력',
        body: '교육 관련 질문을 자유롭게 입력하고 전송하세요.',
        placement: 'top',
      },
      {
        selector: '[data-tour="education-qa-messages"]',
        title: '4. AI 답변 확인',
        body: 'AI의 답변이 여기에 표시됩니다. 스크롤하여 이전 대화를 확인하고, 초기화 버튼으로 새 대화를 시작합니다.',
        placement: 'bottom',
      },
    ],
  },
  'official-doc': {
    id: 'official-doc',
    title: '공문요약·업무추출 사용법',
    steps: [
      {
        selector: '[data-tour="official-doc-input"]',
        title: '1. 공문 입력',
        body: '공문 제목을 적고, 내용을 붙여넣거나 파일·스크린샷을 올립니다. 셋 중 하나만 있어도 됩니다.',
        placement: 'right',
      },
      {
        selector: '[data-tour="official-doc-analyze"]',
        title: '2. 업무 추출',
        body: '이 버튼을 누르면 AI가 핵심 업무와 마감 일정을 간결하게 정리해 줍니다.',
        placement: 'top',
      },
      {
        selector: '[data-tour="official-doc-output"]',
        title: '3. 결과 활용',
        body: '정리된 업무를 복사하거나 TXT로 저장합니다. "할일로 저장"으로 공문 할일 목록에 추가하거나, Google Calendar에 마감 일정을 바로 등록할 수 있습니다.',
        placement: 'left',
      },
    ],
  },
  'teacher-record': {
    id: 'teacher-record',
    title: '수업관찰기록 사용법',
    steps: [
      {
        selector: '[data-tour="teacher-record-header"]',
        title: '1. 우리반기록',
        body: '수업관찰기록·상담일지·학급경영일지를 AI로 작성합니다. 사이드바에서 원하는 유형을 선택하세요.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="teacher-record-input"]',
        title: '2. 관찰 내용 입력',
        body: '교과, 날짜, 학년/반, 관찰 내용을 입력합니다. 교과와 관찰 내용은 필수입니다.',
        placement: 'right',
      },
      {
        selector: '[data-tour="teacher-record-generate"]',
        title: '3. 기록 생성',
        body: '이 버튼을 누르면 AI가 정형화된 기록을 작성해 줍니다.',
        placement: 'top',
      },
      {
        selector: '[data-tour="teacher-record-output"]',
        title: '4. 복사·저장',
        body: '생성된 기록을 복사하거나 TXT 파일로 저장합니다.',
        placement: 'top',
      },
    ],
  },
  'class-tools': {
    id: 'class-tools',
    title: '수업 도구 사용법',
    steps: [
      {
        selector: '[data-tour="class-tools-tabs"]',
        title: '1. 수업 도구',
        body: 'QR 메이커, 럭키드로우, 채팅방 세 가지 도구가 있습니다. 탭을 눌러 전환하고, 오른쪽 "튜토리얼" 버튼으로 언제든 이 안내를 다시 볼 수 있습니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="class-tools-qr"]',
        title: '2. QR 메이커',
        body: 'URL이나 텍스트를 입력하면 QR 코드를 즉시 만들어 줍니다. 이미지로 저장하거나 인쇄해 칠판·유인물에 붙여 활용하세요.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="class-tools-lucky"]',
        title: '3. 럭키드로우',
        body: '학생 이름을 입력하고 돌리면 무작위로 한 명을 뽑아 줍니다. 발표자나 역할을 공정하게 정할 때 좋습니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="class-tools-chat"]',
        title: '4. 채팅방',
        body: '학생이 로그인·설치 없이 QR코드만 스캔해 바로 입장하는 실시간 채팅방입니다. 처음 한 번만 무료 Firebase를 연동하면 되며(안내의 "익명 로그인 켜기" 단계와 데이터베이스 위치 "서울" 선택을 꼭 지켜주세요), 이후 텍스트·링크 대화, 특정 학생에게만 보내는 귓속말(여러 명 선택 가능), 공지 고정, 참여자 확인, 대화 저장까지 할 수 있습니다.',
        placement: 'bottom',
      },
    ],
  },
  'my-tools': {
    id: 'my-tools',
    title: 'AI스킬즈 사용법',
    steps: [
      {
        selector: '[data-tour="my-tools-header"]',
        title: '1. AI스킬즈',
        body: '자주 쓰는 AI 작업 패턴을 스킬로 만들어 저장하고, 동료 선생님과 공유할 수 있습니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="my-tools-tabs"]',
        title: '2. 내 스킬 / 스킬마켓',
        body: '"내 스킬"은 내가 만든 스킬, "스킬마켓"은 다른 선생님이 공유한 스킬입니다. 마켓에서 스킬을 내 스킬로 가져올 수 있습니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="my-tools-list"]',
        title: '3. 스킬 목록',
        body: '▶ 버튼으로 실행, ✏ 버튼으로 편집, ⬇ 버튼으로 내보내기, 🗑 버튼으로 삭제합니다. 핀 고정으로 자주 쓰는 스킬을 상단에 배치할 수 있습니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="my-tools-create"]',
        title: '4. 새 스킬 만들기',
        body: '"새 스킬 만들기"로 AI 프롬프트 스킬, "대화로 만들기"로 AI와 대화하며 제작, "HTML 앱 만들기"로 인터랙티브 앱을 만들 수 있습니다.',
        placement: 'bottom',
      },
    ],
  },
  'html-app': {
    id: 'html-app',
    title: 'HTML 앱 만들기 사용법',
    steps: [
      {
        selector: '[data-tour="html-app-input"]',
        title: '1. 앱 정보 입력',
        body: '앱 이름·종류와 원하는 기능 목록을 입력합니다. 예시 칩을 클릭하면 자동으로 입력됩니다.',
        placement: 'right',
      },
      {
        selector: '[data-tour="html-app-generate"]',
        title: '2. AI로 만들기',
        body: '이 버튼을 누르면 AI가 HTML·CSS·JavaScript를 자동으로 작성합니다.',
        placement: 'top',
      },
      {
        selector: '[data-tour="html-app-preview"]',
        title: '3. 미리보기',
        body: '즉시 실행되는 앱을 미리봅니다. "코드 보기"로 전환하면 코드를 직접 수정할 수 있습니다.',
        placement: 'top',
      },
      {
        selector: '[data-tour="html-app-save"]',
        title: '4. 저장',
        body: '앱 이름과 카테고리를 지정해 내 스킬에 저장하면 언제든 다시 실행할 수 있습니다.',
        placement: 'top',
      },
    ],
  },
  'doc-archive': {
    id: 'doc-archive',
    title: '공문 보관함 사용법',
    steps: [
      {
        selector: '[data-tour="doc-archive-list"]',
        title: '1. 공문 목록',
        body: '저장된 공문을 검색하거나 카테고리(안전·연수·행사 등)로 필터링합니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="doc-archive-add"]',
        title: '2. 공문 추가',
        body: '+ 버튼을 눌러 공문 제목·분류·캡처 이미지·붙임문서·메모를 저장합니다. Ctrl+V로 스크린샷을 바로 붙여넣을 수 있습니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="doc-archive-list"]',
        title: '3. 공문 열기',
        body: '저장된 공문을 클릭하면 캡처 이미지와 붙임문서를 바로 확인할 수 있습니다. 공문 요약·업무추출 기능과 함께 활용하면 더욱 편리합니다.',
        placement: 'bottom',
      },
    ],
  },
  'print-form': {
    id: 'print-form',
    title: '양식 인쇄 사용법',
    steps: [
      {
        selector: '[data-tour="print-form-list"]',
        title: '1. 양식 선택',
        body: '카테고리 탭에서 원하는 분류를 고른 뒤, 양식 이름을 클릭합니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="print-form-editor"]',
        title: '2. 내용 입력',
        body: '각 항목을 입력하면 미리보기가 실시간으로 업데이트됩니다. 미리보기를 직접 클릭해 수정할 수도 있습니다.',
        placement: 'right',
      },
      {
        selector: '[data-tour="print-form-save"]',
        title: '3. 저장·인쇄',
        body: '"PDF 저장·인쇄"로 인쇄하거나, "HWPX 저장"으로 한글 파일로 내보낼 수 있습니다.',
        placement: 'bottom',
      },
    ],
  },
  'student-memo': {
    id: 'student-memo',
    title: '학생 메모 보드 사용법',
    steps: [
      {
        selector: '[data-tour="student-memo-header"]',
        title: '1. 학생 메모 보드',
        body: '학생별 메모를 카드 형태로 저장하고 관리합니다. 수업 중 관찰 내용, 상담 기록 등을 빠르게 남길 수 있습니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="student-memo-search"]',
        title: '2. 검색·필터',
        body: '키워드로 메모를 검색하거나, 드롭다운에서 특정 학생의 메모만 볼 수 있습니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="student-memo-grid"]',
        title: '3. 메모 관리',
        body: '카드를 클릭하면 내용을 편집하고, 🗑 버튼으로 삭제합니다. 우상단 CSV 내보내기로 전체 메모를 파일로 저장할 수 있습니다.',
        placement: 'top',
      },
    ],
  },
  'opinion-gen': {
    id: 'opinion-gen',
    title: '행발 생성기 사용법',
    steps: [
      {
        selector: '[data-tour="opinion-gen-header"]',
        title: '1. 행동특성 및 종합의견 생성기',
        body: '학생별 행동특성 및 종합의견 문장을 AI로 생성합니다. 상단 단계 표시(1→2→3)를 따라 진행하면 됩니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="opinion-gen-setup"]',
        title: '2. 인원 설정',
        body: '생성할 학생 수를 설정하고 이름을 입력합니다. 설정에 저장된 우리 반 명단을 자동으로 불러올 수도 있습니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="opinion-gen-config"]',
        title: '3. 특성 선택',
        body: '긍정적 특성과 보완이 필요한 특성을 태그로 선택합니다. 학생별로 개별 내용을 추가로 입력할 수도 있습니다.',
        placement: 'right',
      },
      {
        selector: '[data-tour="opinion-gen-result"]',
        title: '4. 결과 확인',
        body: '생성된 행발 문장을 학생별로 확인합니다. 복사 버튼으로 각 문장을 복사하거나 재생성할 수 있습니다.',
        placement: 'top',
      },
    ],
  },
  'subject-gen': {
    id: 'subject-gen',
    title: '세특 생성기 사용법',
    steps: [
      {
        selector: '[data-tour="subject-gen-header"]',
        title: '1. 교과세특 생성기',
        body: '학생별 교과학습발달상황(세특) 문장을 AI로 생성합니다. NEIS 성적 파일을 업로드하면 명단·과목·평가 정보가 자동으로 입력됩니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="subject-gen-setup"]',
        title: '2. 인원 설정',
        body: '학생 수와 이름을 입력합니다. NEIS 성적 자료를 업로드하면 이 단계를 자동으로 건너뛸 수 있습니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="subject-gen-config"]',
        title: '3. 과목 및 평가과제 설정',
        body: '교과목을 선택하고 평가 과제(수행평가·서술형 등)를 입력합니다. 평가계획서 파일을 첨부해 자동으로 분석할 수도 있습니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="subject-gen-result"]',
        title: '4. 결과 확인',
        body: '학생별 세특 문장을 확인하고 복사하거나 저장합니다. 재생성 버튼으로 특정 학생만 다시 생성할 수도 있습니다.',
        placement: 'top',
      },
    ],
  },
  'sports-gen': {
    id: 'sports-gen',
    title: '스포츠클럽 특기사항 사용법',
    steps: [
      {
        selector: '[data-tour="sports-gen-header"]',
        title: '1. 스포츠클럽 특기사항 생성기',
        body: '학생별 학교스포츠클럽 특기사항 문장을 AI로 생성합니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="sports-gen-setup"]',
        title: '2. 인원 설정',
        body: '생성할 학생 수를 설정하고 이름을 입력합니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="sports-gen-config"]',
        title: '3. 활동 입력',
        body: '종목명과 긍정·부정 특성 태그를 선택합니다. 학생별 개별 활동 내용도 추가로 입력할 수 있습니다.',
        placement: 'right',
      },
      {
        selector: '[data-tour="sports-gen-result"]',
        title: '4. 결과 확인',
        body: '생성된 특기사항 문장을 학생별로 확인하고 복사합니다.',
        placement: 'top',
      },
    ],
  },
  'creative-gen': {
    id: 'creative-gen',
    title: '창체 특기사항 사용법',
    steps: [
      {
        selector: '[data-tour="creative-gen-header"]',
        title: '1. 창의적 체험활동 특기사항 생성기',
        body: '자율활동·동아리·진로·봉사 등 창의적 체험활동 특기사항 문장을 AI로 생성합니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="creative-gen-setup"]',
        title: '2. 인원 설정',
        body: '생성할 학생 수와 이름을 입력합니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="creative-gen-config"]',
        title: '3. 활동 설정',
        body: '활동 유형(자율/동아리/진로/봉사)과 활동명, 연간 지도계획을 입력합니다. 계획 문서를 파일로 업로드하면 자동으로 분석합니다.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="creative-gen-result"]',
        title: '4. 결과 확인',
        body: '학생별 창체 특기사항 문장을 확인하고 복사하거나 저장합니다.',
        placement: 'top',
      },
    ],
  },
};
