// Gemini API 키 없이 쓸 수 있는 기능과 키가 있어야 하는 기능의 목록.
//
// 설정 화면·사용 방법 화면·최초 실행 온보딩 세 곳이 같은 안내를 보여주므로,
// 목록을 한 곳에 두고 모두 여기서 가져다 쓴다. 기능을 추가할 때 이 파일만 고치면 된다.
//
// 분류 기준은 "그 화면이 Gemini 생성을 호출하는가"다.
// 나라장터 인증키처럼 Gemini와 다른 자격증명이 필요한 기능은 needsKey가 아니라
// 각 항목의 note로 따로 알린다.

export interface FeatureGroup {
  /** 사이드바에서 보이는 영역 이름 */
  section: string;
  /** 그 영역에서 해당하는 기능 이름들 */
  features: string[];
  /** 조건이 붙는 경우의 부연 설명 */
  note?: string;
}

/** API 키 없이 바로 쓸 수 있는 기능. */
export const FEATURES_WITHOUT_KEY: FeatureGroup[] = [
  {
    section: '학생기록AI',
    features: ['학생 메모 보드', '학생 카드'],
  },
  {
    section: '교무행정AI',
    features: ['공문 보관함', '공문 할일', '양식 인쇄'],
  },
  {
    section: '수업자료AI',
    features: ['나만의 자료실', 'QR 메이커', '오늘의 주인공 추첨', 'QR 채팅방'],
    note: '자료실에서 자료를 모으고 여는 기능은 키 없이 되고, 자료 분류를 AI에게 맡기는 기능만 키가 필요합니다.',
  },
  {
    section: '기타',
    features: ['홈', '사용 방법', '설정', '도움말/정보', '전체 자료 백업·불러오기', 'Demo 샘플 보기'],
  },
];

/** Gemini API 키가 있어야 동작하는 기능. */
export const FEATURES_NEEDING_KEY: FeatureGroup[] = [
  {
    section: '학생기록AI',
    features: [
      '학생기록AI 챗봇',
      '행발생성(행동특성 및 종합의견)',
      '교과 세특 생성',
      '학교스포츠클럽 특기사항',
      '창의적 체험활동 특기사항',
      '수업관찰기록',
      '상담일지',
      '학급경영일지',
    ],
  },
  {
    section: '교무행정AI',
    features: [
      '교무행정AI 챗봇',
      '공문요약·업무추출',
      '문서작성기(공문서·계획서·보고서 등)',
      '간단 번역',
    ],
  },
  {
    section: '수업자료AI',
    features: ['수업자료 생성(슬라이드·워크시트·퀴즈·수업계획서·교육용 게임)'],
  },
  {
    section: 'AI 스킬즈',
    features: ['스킬 만들기·실행', 'HTML 앱 만들기'],
  },
  {
    section: '예산안작성',
    features: ['AI 예산안 초안 만들기', '시중가 웹 검색 참고가'],
    note: '예산표를 직접 입력하고 CSV로 저장하는 기능은 키 없이 됩니다. 나라장터 품목 검색은 Gemini 키가 아니라 나라장터 인증키가 따로 필요합니다.',
  },
];

/** 안내 문구 한 줄 요약 — 좁은 화면(온보딩 등)에서 목록 대신 쓴다. */
export const API_KEY_SCOPE_SUMMARY =
  'AI가 글을 만들어 주는 기능에는 키가 필요하고, 메모·양식 인쇄·QR·채팅방·보관함처럼 직접 쓰고 관리하는 기능은 키 없이 바로 쓸 수 있습니다.';
