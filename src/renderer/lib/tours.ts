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
};
