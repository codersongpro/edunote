import React, { useCallback, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react';

type Field = { label: string; value: string };
type Sample = { title: string; note?: string; fields: Field[] };
type Category = { id: string; icon: string; title: string; samples: Sample[] };

const DEMO_DATA: Category[] = [
  {
    id: 'settings',
    icon: '⚙️',
    title: '설정 화면',
    samples: [
      {
        title: '기본 교사 정보',
        fields: [
          { label: '이름', value: '박지은' },
          { label: '소속 기관', value: '충북초등학교' },
          { label: '학년/반', value: '5학년 2반' },
        ],
      },
      {
        title: '주의어 사전',
        note: '설정의 사용자 주의어/금지 표현에 붙여넣어 테스트하세요.',
        fields: [
          { label: '주의어', value: '우수함, 성실함, 모범적, 탁월함, 부적절한 표현' },
        ],
      },
      {
        title: '자동 정기 백업',
        fields: [
          { label: '백업 주기', value: '매주 금요일 16:30' },
          { label: '확인할 내용', value: '설정의 전체 자료 백업에서 자동 정기 백업 상태와 최근 백업 시간을 확인합니다.' },
        ],
      },
    ],
  },
  {
    id: 'admin',
    icon: '📄',
    title: '교무행정AI',
    samples: [
      {
        title: '교무행정AI 챗봇',
        fields: [
          { label: '질문', value: '초등학교 AI 동아리를 처음 운영하려고 합니다. 운영 계획서에 꼭 들어가야 할 항목을 체크리스트로 정리해 주세요.' },
        ],
      },
      {
        title: '공문요약·업무추출',
        note: '"텍스트 직접 입력" 칸에 붙여넣어 시연하세요.',
        fields: [
          {
            label: '샘플 공문',
            value: `수신 충북초등학교장
제목 2026학년도 학생 AI 교육 지원 사업 신청 안내

1. 관련: 미래교육과-2156(2026. 2. 20.)
2. 학생 AI 교육 활성화를 위해 다음과 같이 지원 사업을 안내하오니 희망 학교는 신청하여 주시기 바랍니다.

가. 지원 내용
  1) AI 동아리 운영학교: 교당 500,000원 지원
  2) AI 교육 담당교사 연수: 2026. 4. 9. 실시
나. 신청 방법
  1) 신청 기간: 2026. 3. 4. ~ 2026. 3. 14.
  2) 제출 서류: 운영 계획서 1부
  3) 제출처: 업무포털 공문 제출
다. 유의 사항
  - 운영 결과 보고서는 2026. 11. 30.까지 제출
  - 예산 집행 증빙 자료 보관 필수
  - 참고 웹사이트: https://www.moe.go.kr`,
          },
        ],
      },
      {
        title: '공문 할일 저장',
        fields: [
          { label: '저장할 업무', value: '운영 계획서 제출, 예산 집행 증빙 자료 보관, 결과 보고서 제출' },
          { label: '확인할 내용', value: '공문요약·업무추출 결과에서 할일로 저장한 뒤 공문 할일 메뉴에 바로 표시되는지 확인합니다.' },
        ],
      },
      {
        title: '문서작성기 - 내부결재 공문',
        fields: [
          { label: '제목', value: '2026학년도 학생 AI 탐구 동아리 운영 계획' },
          { label: '본문 요청사항', value: '대상은 5~6학년 희망 학생 20명, 운영 기간은 2026년 4월부터 11월까지, 활동 시간은 매주 금요일 방과 후 1시간입니다. 주요 활동은 AI 기초 개념 학습, 이미지 생성 체험, 챗봇 활용 실습, 학생 AI 작품 전시회 준비입니다.' },
        ],
      },
      {
        title: '문서작성기 - 가정통신문',
        fields: [
          { label: '제목', value: '학생 AI 탐구 동아리 참가 신청 안내' },
          { label: '안내 내용', value: '5~6학년 희망 학생을 대상으로 AI 탐구 동아리를 운영합니다. 신청 기간은 3월 20일까지이며, 담임교사에게 신청서를 제출하면 됩니다. 활동은 매주 금요일 방과 후 1시간 진행됩니다.' },
        ],
      },
      {
        title: '가정통신문 다국어 번역',
        fields: [
          { label: '원문', value: 'AI 탐구 동아리 참가 신청 안내문을 학부모님께 전달합니다.' },
          { label: '번역 언어', value: '영어, 중국어, 일본어, 베트남어, 러시아어, 우즈베크어 등 13개 언어' },
        ],
      },
      {
        title: 'HWPX 저장 확인',
        fields: [
          { label: '저장 형식', value: 'HWPX' },
          { label: '확인할 내용', value: '22pt 제목, 15pt 번호, 14pt 본문·표 서식과 (YYMMDD)_제목.hwpx 파일명을 확인합니다.' },
        ],
      },
      {
        title: '문서작성기 - 계획서',
        fields: [
          { label: '주제/사업명', value: '2026학년도 독서교육 운영 계획' },
          { label: '대상', value: '전교생 (1~6학년)' },
          { label: '예산', value: '800,000원' },
          { label: '추가 사항', value: '매달 학급 독서 토의 1회, 학기별 독서 감상문 대회 1회, 도서관 활용 수업 연계' },
        ],
      },
      {
        title: '문서작성기 - 보고서',
        fields: [
          { label: '주제/사업명', value: '2026학년도 AI 디지털 소양 교육 운영 결과' },
          { label: '대상', value: '4~6학년 (참여 학생 120명)' },
          { label: '예산', value: '500,000원' },
          { label: '운영 결과 및 주요 내용', value: '총 6차시 운영, 챗봇 체험·이미지 생성·AI 윤리 토론 활동 진행. 학생 만족도 4.6/5.0, 교사 자체 평가 우수.' },
          { label: '추가 사항', value: '내년 전 학년 확대 운영 예정' },
        ],
      },
      {
        title: '문서작성기 - 품의서',
        note: '품의 유형은 "물품 구매"로 선택하세요.',
        fields: [
          { label: '품의 제목/건명', value: '2026학년도 독서교육 도서 구입' },
          { label: '소요 예산', value: '800000' },
          { label: '산출 내역', value: '도서 구입비: 10,000원 × 80권 = 800,000원' },
          { label: '세부 내역 (물품명·수량·단가)', value: '초등 권장도서(1~6학년 각 10권씩): 10,000원 × 60권 = 600,000원\n교사 연구도서: 10,000원 × 20권 = 200,000원' },
          { label: '구입 목적', value: '학생 독서 습관 형성 및 교원 수업 연구 지원' },
        ],
      },
      {
        title: '문서작성기 - 협의록',
        fields: [
          { label: '제목', value: '2026학년도 1학기 학년협의회' },
          { label: '일시', value: '2026. 6. 10.(화) 16:00~17:00' },
          { label: '장소', value: '3학년 교무실' },
          { label: '출석자', value: '3학년 담임교사 4명, 교과 전담교사 2명' },
          { label: '회의 안건', value: '학기말 평가 일정 조율, 학예회 학년 발표 순서 확정, 현장체험학습 사전 안전교육 방법 협의' },
          { label: '회의 내용', value: '평가는 6월 23~27일로 확정, 학예회 3학년 발표는 2부 세 번째, 현장체험학습 안전교육은 6월 16일 학급별 실시하기로 결정' },
        ],
      },
      {
        title: '문서작성기 - 보도자료',
        fields: [
          { label: '행사 일시', value: '2026. 6. 20.(토) 10:00~15:00' },
          { label: '대상', value: '전교생 및 학부모, 지역 주민' },
          { label: '내용', value: '학생 AI 작품 전시, 체험 부스 운영(생성 AI 그림 그리기, 챗봇 만들기), 학교 오케스트라 공연, 먹거리 장터' },
          { label: '목적/의의', value: '학생들의 AI 창작 성과 공유 및 지역사회와 함께하는 학교 문화 조성' },
          { label: '인터뷰 대상자', value: '교장 선생님, 6학년 대표 학생, 학부모 참여자' },
        ],
      },
      {
        title: '문서작성기 - 메세지 (문자)',
        note: '"메세지" 탭 → 문자 메세지를 선택하세요.',
        fields: [
          { label: '내용', value: '6월 20일(토) 학교 축제가 열립니다. 오전 10시부터 오후 3시까지 학교 운동장에서 진행되오니 많은 참여 부탁드립니다.' },
        ],
      },
      {
        title: '문서작성기 - 메세지 (소통)',
        note: '"메세지" 탭 → 소통 메세지를 선택하세요.',
        fields: [
          { label: '나와의 관계', value: '학부모' },
          { label: '작성 내용', value: '다음 주 현장체험학습 관련하여 준비물과 당일 일정을 안내드리고, 도시락 지참 여부와 귀가 시간을 알려드리려 합니다.' },
        ],
      },
      {
        title: '문서작성기 - 공고문',
        fields: [
          { label: '제목', value: '2026학년도 방과후학교 강사 모집 공고' },
          { label: '공고 번호', value: '제2026-08호' },
          { label: '공고 내용', value: '영어회화, 미술, 컴퓨터 코딩 강좌 각 1명 모집. 자격 요건은 관련 분야 자격증 소지자 또는 2년 이상 강의 경력자.' },
          { label: '마감일', value: '2026. 6. 30.' },
          { label: '문의처', value: '교무실 (043-000-0000)' },
        ],
      },
      {
        title: '간단 번역',
        fields: [
          { label: '번역 방향', value: '한국어 → 베트남어' },
          { label: '원문', value: '내일 체험학습은 오전 9시에 출발합니다. 편한 복장과 물을 준비해 주세요.' },
        ],
      },
    ],
  },
  {
    id: 'student',
    icon: '🎓',
    title: '학생기록AI',
    samples: [
      {
        title: '학생기록AI 챗봇',
        fields: [
          { label: '질문', value: '초등학교 5학년 학생의 관찰 기록을 생활기록부 문장으로 바꿀 때 피해야 할 표현과 권장 표현을 알려 주세요.' },
        ],
      },
      {
        title: '행발생성',
        fields: [
          { label: '학생 이름', value: '김서윤, 이도현, 박민준' },
          { label: '관찰 내용', value: '김서윤: 모둠 활동에서 역할을 스스로 나누고 친구의 의견을 정리함.\n이도현: 발표 준비 과정에서 자료를 꾸준히 보완하고 질문에 성실히 답함.\n박민준: 새로운 아이디어를 제안하지만 과제 마무리 시간이 늦어질 때가 있음.' },
        ],
      },
      {
        title: '교과 세특 생성',
        fields: [
          { label: '교과', value: '국어' },
          { label: '과제', value: 'AI 활용 찬반 토론 후 주장하는 글 쓰기' },
          { label: '관찰 내용', value: '근거 자료를 찾아 자신의 주장과 연결하였고, 친구의 반론을 듣고 문장을 수정하는 태도가 돋보임.' },
        ],
      },
      {
        title: '수업관찰기록',
        fields: [
          { label: '수업 주제', value: 'AI 이미지 생성 도구를 활용한 환경 포스터 만들기' },
          { label: '관찰 내용', value: '학생들이 프롬프트를 수정하며 결과물을 비교했고, 저작권과 출처 표시 필요성을 자연스럽게 토의함.' },
        ],
      },
      {
        title: '상담일지',
        fields: [
          { label: '상담 유형', value: '학습 상담' },
          { label: '상담 내용', value: '최근 과제 제출이 늦어진 이유를 확인하고, 매일 10분씩 학습 계획을 점검하는 방법을 함께 정함.' },
        ],
      },
      {
        title: '학급경영일지',
        fields: [
          { label: '날짜 범위', value: '2026. 6. 8. ~ 2026. 6. 12.' },
          { label: '주요 활동', value: '국어 토론 수업, AI 윤리 프로젝트, 학급 자치회의, 체육대회 준비' },
          { label: '담임 메모', value: '모둠별 역할 분담은 안정적이었으나 발표 순서 조정에서 일부 갈등이 있어 다음 주 자치회의에서 다시 다룰 예정임.' },
        ],
      },
      {
        title: '학생 메모 보드',
        fields: [
          { label: '학생명', value: '김서윤' },
          { label: '메모', value: '모둠 발표 전 친구들의 의견을 표로 정리해 공유함. 다음 생기부 생성 시 협업 태도 참고.' },
        ],
      },
    ],
  },
  {
    id: 'lesson',
    icon: '📚',
    title: '수업자료AI',
    samples: [
      {
        title: '수업자료 생성 - 프레젠테이션',
        fields: [
          { label: '교과', value: '실과' },
          { label: '단원', value: '정보 사회와 인공지능' },
          { label: '주제', value: '인공지능은 우리 생활에서 어떻게 활용될까?' },
          { label: '추가 요청', value: '6장 내외, 초등학생 눈높이, 마지막 장에 AI 윤리 생각 질문 포함' },
        ],
      },
      {
        title: '수업자료 생성 - 활동지',
        fields: [
          { label: '교과', value: '실과' },
          { label: '주제', value: 'AI가 학습하는 과정 이해하기' },
          { label: '추가 요청', value: '빈칸 채우기 3문항, 생각 나누기 2문항, 생활 속 AI 찾기 활동 포함' },
        ],
      },
      {
        title: '수업 도구 - QR 메이커',
        fields: [
          { label: 'URL', value: 'https://www.ebs.co.kr' },
          { label: '표시 이름', value: 'EBS 학습 자료' },
        ],
      },
      {
        title: '수업 도구 - 럭키드로우',
        fields: [
          { label: '참가자 목록', value: '김서윤\n이도현\n박민준\n최수아\n정하린\n오지후' },
        ],
      },
      {
        title: '나만의 자료실',
        fields: [
          { label: '자료 제목', value: 'AI 윤리 수업 참고 영상' },
          { label: 'URL', value: 'https://www.youtube.com/watch?v=example' },
          { label: '메모', value: '5학년 실과 AI 윤리 차시 도입 자료로 활용. 개인정보와 저작권 질문과 연결하기 좋음.' },
        ],
      },
    ],
  },
  {
    id: 'budget',
    icon: '💰',
    title: '예산안작성',
    samples: [
      {
        title: '예산안 만들기 - 과목별(비율) 방식',
        note: '예산안작성 메뉴에서 "과목별(비율)" 방식을 선택하고 아래 값을 입력하세요.',
        fields: [
          { label: '예산 제목', value: '2026. AI·디지털선도학교 운영 예산' },
          { label: '총 예산 금액', value: '10,000,000' },
          { label: '교육운영비 비율', value: '60' },
          { label: '일반운영비 비율', value: '37' },
          { label: '업무추진비 비율', value: '3' },
          { label: '희망 물품', value: '학습용 태블릿, 헤드셋, AI 교육 콘텐츠 라이선스' },
        ],
      },
      {
        title: '예산안 만들기 - 일반 작성 방식',
        note: '예산안작성 메뉴에서 "일반 작성" 방식을 선택하고 아래 값을 입력하세요.',
        fields: [
          { label: '예산 제목', value: '2026. 독서교육 활성화 사업 예산' },
          { label: '총 예산 금액', value: '3,000,000' },
          { label: '희망 물품', value: '도서, 독서기록장, 독서 이벤트 상품' },
        ],
      },
      {
        title: '0원 맞추기 - 수량 범위 예시',
        note: '예산안 생성 후 품목 행의 최소수량·최대수량 칸에 입력한 뒤 "0원 맞추기"를 눌러보세요.',
        fields: [
          { label: '최소수량 예시', value: '1' },
          { label: '최대수량 예시', value: '10' },
        ],
      },
    ],
  },
  {
    id: 'print',
    icon: '🖨️',
    title: '양식 인쇄',
    samples: [
      {
        title: '학급 회의록',
        note: '양식 인쇄 메뉴에서 "학급 회의록"을 선택하고 아래 값을 입력하세요.',
        fields: [
          { label: '일시', value: '2026. 6. 10.(화) 14:00 ~ 14:40' },
          { label: '장소', value: '5학년 2반 교실' },
          { label: '사회', value: '회장 이서준' },
          { label: '서기', value: '부회장 김하은' },
          { label: '안건', value: '학급 독서 이벤트 운영 방법, 5월 학급 자치 활동 결과 공유' },
          { label: '협의 내용', value: '독서 이벤트는 매주 월요일 아침 10분 독서 릴레이로 진행하기로 함. 가장 재미있게 읽은 책을 1문장으로 소개하는 형식.' },
          { label: '결정 사항', value: '독서 릴레이 6월 17일(월)부터 시작. 담당 역할: 이서준(진행), 김하은(기록)' },
        ],
      },
      {
        title: '1인 1역할',
        note: '양식 인쇄 메뉴에서 "1인 1역할"을 선택하고 아래 값을 "역할/담당학생" 형식으로 입력하세요.',
        fields: [
          { label: '역할 목록 (역할/담당학생)', value: '출석부/김서윤\n칠판지우기/이도현\n화분관리/박민준\n창문/최수아\n전등/정하린\n온도계/오지후\n게시판/김태양\n급식도우미/이소민' },
        ],
      },
      {
        title: '연수 등록부',
        note: '양식 인쇄 메뉴에서 "연수 등록부"를 선택하고 아래 값을 입력하세요. "명단 추가" 버튼으로 20명 이상도 입력할 수 있습니다.',
        fields: [
          { label: '연수명', value: '2026. AI 활용 수업 역량 강화 연수' },
          { label: '일시', value: '2026. 6. 20.(금) 15:00 ~ 17:00' },
          { label: '장소', value: '충북초등학교 시청각실' },
          { label: '연수 대상', value: '전 교직원' },
          { label: '참가자 명단', value: '박지은\n김민수\n이지혜\n최성훈\n정유나\n오재원\n한소희\n강민준\n윤채원\n임도현' },
        ],
      },
    ],
  },
  {
    id: 'htmlapp',
    icon: '🖥️',
    title: 'HTML 앱 만들기',
    samples: [
      {
        title: '어휘 플래시카드',
        note: '내 스킬 → HTML 앱 만들기에서 "어휘 플래시카드" 예시를 클릭하면 사과/apple 등 6쌍이 미리 채워진 채 앱이 생성됩니다.',
        fields: [
          { label: '앱 유형', value: '어휘 플래시카드' },
          { label: '기능 설명', value: '사과/apple, 책/book, 학교/school, 친구/friend, 선생님/teacher, 공부하다/study 6쌍 기본 제공. 카드 클릭 시 앞/뒷면 뒤집기, 이전/다음 버튼, 맞힘/틀림 버튼과 정답률 표시, 단어/뜻 쌍 추가·수정 가능.' },
        ],
      },
      {
        title: '낱말 맞추기 퀴즈',
        note: '내 스킬 → HTML 앱 만들기에서 아래 정보를 입력하세요.',
        fields: [
          { label: '앱 유형', value: '퀴즈 앱' },
          { label: '기능 설명', value: '국어 5학년 1학기 낱말 퀴즈. 문제 10개, 4지선다, 제한시간 20초, 오답 시 정답 표시, 최종 점수 100점 만점으로 표시' },
        ],
      },
    ],
  },
  {
    id: 'skills',
    icon: '🛠️',
    title: 'AI 스킬즈',
    samples: [
      {
        title: '내 스킬 - AI 스킬 만들기',
        fields: [
          { label: '도구 이름', value: '학급 안내문 문장 다듬기' },
          { label: '도구 설명', value: '학부모 안내문 초안을 입력하면 더 정중하고 읽기 쉬운 문장으로 다듬어 주는 도구입니다.' },
          { label: '프롬프트', value: '아래 안내문 초안을 학부모에게 전달하기 적절한 문체로 다듬어 주세요. 문장은 간결하게 쓰고, 날짜와 준비물은 표로 정리해 주세요.' },
        ],
      },
      {
        title: '내 스킬 공유 설문',
        fields: [
          { label: '만드신 도구의 종류', value: 'AI 스킬' },
          { label: '도구 이름', value: '학급 안내문 문장 다듬기' },
          { label: '공유 메시지', value: '반복해서 작성하는 학급 안내문을 빠르게 다듬기 위해 만든 도구입니다.' },
        ],
      },
      {
        title: '스킬마켓 - 이수증 연수번호 수집기',
        fields: [
          { label: '사용 예시', value: '이수증 파일을 올린 뒤 성명, 연수명, 이수 날짜, 이수 시간, 연수 기관, 연수번호를 표로 추출합니다. 결과는 성명 기준 가나다순으로 정렬됩니다.' },
        ],
      },
    ],
  },
];

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-all ${
        copied
          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-200 border border-green-300 dark:border-green-700'
          : 'bg-white dark:bg-[#2E2822] text-[#78716C] dark:text-[#C4B8B0] hover:bg-blue-50 dark:hover:bg-blue-900/50 hover:text-blue-700 dark:hover:text-blue-100 border border-[#E7E5E4] dark:border-[#2E2822]'
      }`}
      title="클립보드에 복사"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? '복사됨' : '복사'}
    </button>
  );
};

const DemoSamplesScreen: React.FC = () => {
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set([DEMO_DATA[0].id]));
  const [openSamples, setOpenSamples] = useState<Set<string>>(new Set());

  const toggleCategory = (id: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSample = (key: string) => {
    setOpenSamples(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#FAF9F7] dark:bg-[#171210]">
      <div className="mx-auto w-full max-w-2xl space-y-3 px-5 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-black text-[#1C1917] dark:text-[#F0EBE6]">시연 샘플</h1>
          <p className="mt-0.5 text-sm text-[#78716C] dark:text-[#C4B8B0]">각 항목의 복사 버튼으로 입력칸에 붙여넣기 하세요.</p>
          <p className="mt-1 text-xs text-[#78716C] dark:text-[#9C8F87]">
            가상 교사: <strong>박지은</strong> | 학교: <strong>충북초등학교</strong> | 학년/반: <strong>5학년 2반</strong>
          </p>
        </div>

        {DEMO_DATA.map(cat => (
          <div key={cat.id} className="overflow-hidden rounded-xl border border-[#E7E5E4] bg-white dark:border-[#2E2822] dark:bg-[#221E1B]">
            <button
              onClick={() => toggleCategory(cat.id)}
              className="w-full px-4 py-3 text-left transition-colors hover:bg-[#FAF9F7] dark:hover:bg-[#2E2822]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="truncate font-bold text-[#1C1917] dark:text-[#F0EBE6]">{cat.title}</span>
                  <span className="rounded-full bg-[#EDE8E1] px-2 py-0.5 text-xs text-[#78716C] dark:bg-[#2E2822] dark:text-[#C4B8B0]">{cat.samples.length}</span>
                </div>
                {openCategories.has(cat.id)
                  ? <ChevronDown className="h-4 w-4 shrink-0 text-[#78716C] dark:text-[#C4B8B0]" />
                  : <ChevronRight className="h-4 w-4 shrink-0 text-[#78716C] dark:text-[#C4B8B0]" />
                }
              </div>
            </button>

            {openCategories.has(cat.id) && (
              <div className="divide-y divide-[#EDE8E1] border-t border-[#EDE8E1] dark:divide-[#2E2822] dark:border-[#2E2822]">
                {cat.samples.map((sample, si) => {
                  const sampleKey = `${cat.id}-${si}`;
                  const isOpen = openSamples.has(sampleKey);
                  return (
                    <div key={sampleKey}>
                      <button
                        onClick={() => toggleSample(sampleKey)}
                        className="w-full px-4 py-2.5 text-left transition-colors hover:bg-[#FAF9F7] dark:hover:bg-[#2E2822]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-[#44403C] dark:text-[#C4B8B0]">{sample.title}</span>
                          {isOpen
                            ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#78716C] dark:text-[#C4B8B0]" />
                            : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#78716C] dark:text-[#C4B8B0]" />
                          }
                        </div>
                      </button>

                      {isOpen && (
                        <div className="space-y-2 px-4 pb-3">
                          {sample.note && (
                            <p className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-100">{sample.note}</p>
                          )}
                          {sample.fields.map((field, fi) => (
                            <div key={`${sampleKey}-${fi}`} className="rounded-lg bg-[#FAF9F7] p-2.5 dark:bg-[#171210]/70">
                              <div className="mb-1 flex items-start justify-between gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wide text-[#78716C] dark:text-[#C4B8B0]">{field.label}</span>
                                <CopyButton text={field.value} />
                              </div>
                              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#1C1917] dark:text-[#C4B8B0]">{field.value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DemoSamplesScreen;
