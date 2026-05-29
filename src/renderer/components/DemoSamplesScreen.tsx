import React, { useState, useCallback } from 'react';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';

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
          { label: '소속기관', value: '충북초등학교' },
          { label: '학년/반', value: '5학년 2반' },
        ],
      },
    ],
  },
  {
    id: 'schooldoc',
    icon: '📄',
    title: '공문서 작성',
    samples: [
      {
        title: '공문서 (내부결재)',
        fields: [
          { label: '제목 (건명)', value: '2026학년도 5학년 현장체험학습 실시 계획' },
          { label: '본문 요청사항', value: '5월 16일(금) 청주 국립청주박물관 방문 / 대상: 5학년 전체 92명 / 목적: 역사·문화 탐방 / 인솔교사 8명 동행 / 차량 2대 / 기타사항: 우천 시 5월 23일로 변경' },
        ],
      },
      {
        title: '계획서',
        fields: [
          { label: '주제/사업명', value: '2026학년도 학생 독서 역량 강화 프로그램 운영 계획' },
          { label: '대상', value: '전교생 (1~6학년, 약 480명)' },
          { label: '예산 (원)', value: '1,200,000' },
          { label: '추가 사항', value: '3월~11월 운영 / 매주 수요일 아침독서 20분 실시 / 학년별 권장도서 목록 제공 / 독서 감상문 쓰기 대회(5월, 10월) 연계 / 학년 말 독서왕 시상' },
        ],
      },
      {
        title: '보고서',
        fields: [
          { label: '주제/사업명', value: '2026학년도 학생 독서 역량 강화 프로그램 운영 결과 보고' },
          { label: '대상', value: '전교생 480명' },
          { label: '예산/집행액', value: '계획액 1,200,000원 / 집행액 1,175,000원' },
          { label: '운영 결과', value: '3월~11월 총 8개월 운영 완료 / 아침독서 주 1회(수요일) 정기 실시 / 독서 감상문 대회 2회 실시(5월 127명, 10월 134명 참가) / 학년별 권장도서 목록 배포 완료 / 독서왕 시상 6명 / 학생 독서량 전년 대비 평균 23% 증가' },
          { label: '추가 사항', value: '학부모 설문 결과 만족도 4.6점(5점 만점) / 내년 운영 시 도서 구입 예산 확대 필요' },
        ],
      },
      {
        title: '품의서 — 물품 구입',
        fields: [
          { label: '품의 제목/건명', value: '2026학년도 5학년 과학 실험 기자재 구입' },
          { label: '관련 공문/근거', value: '2026학년도 교육과정 운영 계획' },
          { label: '소요 예산', value: '350,000' },
          { label: '산출 내역', value: '실험 장갑 50개 × 1,000원 + 비커세트 10개 × 15,000원 + 알코올램프 10개 × 20,000원 = 350,000원' },
          { label: '세부 내역', value: '실험 장갑 50개, 비커세트(300ml) 10개, 알코올램프 10개' },
          { label: '구입 목적', value: '2학기 5학년 과학 연소 단원 실험 수업 준비' },
        ],
      },
      {
        title: '협의록',
        fields: [
          { label: '회의 제목', value: '2026학년도 1학기 5학년 현장체험학습 운영 협의회' },
          { label: '학교명', value: '충북초등학교' },
          { label: '일시', value: '2026. 4. 10.(목) 16:00 ~ 17:00' },
          { label: '장소', value: '5학년 교무실' },
          { label: '출석위원', value: '교장, 교감, 교무부장, 5학년 담임교사 4명 (총 6명)' },
          { label: '회의 안건', value: '2026학년도 5학년 현장체험학습(청주 국립청주박물관) 운영 계획 검토' },
          { label: '회의 내용 요약', value: '박지은 교사가 5월 16일 국립청주박물관 현장체험학습 계획 발표 / 교감이 안전 관리 인솔 교사 배치 충분한지 확인 요청 → 학년부장이 인솔교사 8명으로 20명당 1명 배치 확인 / 교장이 우천 대비 예비일(5.23) 확정 승인 / 참가비 1인 15,000원 책정 관련 학부모 동의서 선발송 결정 / 모든 위원 이의 없이 원안 승인' },
        ],
      },
      {
        title: '가정통신문',
        fields: [
          { label: '제목', value: '5학년 현장체험학습 실시 안내' },
          { label: '수신 대상', value: '5학년 학부모님' },
          { label: '안내 내용', value: '일시: 2026년 5월 16일(금) 09:00~15:00 / 장소: 국립청주박물관 / 참가비: 1인 15,000원(차량비·입장료·점심 포함) / 준비물: 편한 복장, 개인 물통, 간식(간단히) / 우천 시 5월 23일(금)로 변경 / 참가비는 5월 9일(금)까지 학교 계좌로 납부 바랍니다 / 문의: 5학년 교무실 043-000-0000' },
        ],
      },
      {
        title: '소통 메세지 — 학부모 SMS',
        fields: [
          { label: '전달 내용', value: '5월 16일 현장체험학습 당일 등교 시간은 평소와 동일(8시 40분)하며, 도시락 없이 점심은 도시락 지참 필요. 편한 복장 착용 바랍니다.' },
        ],
      },
      {
        title: '소통 메세지 — 학부모 LMS 답장',
        fields: [
          { label: '받은 메시지', value: '선생님, 저희 아이가 현장체험학습 날 몸이 좋지 않을 것 같은데 당일 결석하면 어떻게 되나요? 참가비는 환불이 되는지도 여쭤보고 싶습니다.' },
          { label: '답장 내용', value: '결석 시 대처 방법과 참가비 환불 여부 안내. 따뜻하고 친절한 답장으로 작성.' },
        ],
      },
      {
        title: '공고문',
        fields: [
          { label: '공고 제목', value: '2026학년도 방과후학교 영어회화 강사 채용 공고' },
          { label: '공고 번호', value: '제2026-012호' },
          { label: '공고 내용 요약', value: '주 3회(월·수·금) 방과후 영어회화 수업 진행 / 대상: 3~6학년 희망 학생 / 시간: 오후 2시~3시 / 자격: 영어 관련 학사 이상 또는 교원 자격증 소지자 / 경력자 우대 / 계약기간 2026년 3월~2027년 2월 / 강사료 시간당 40,000원' },
          { label: '접수 기간/마감일', value: '2026. 2. 3.(월) ~ 2026. 2. 14.(금) 16:00까지' },
          { label: '문의처', value: '충북초등학교 교무실 (043-000-0000)' },
        ],
      },
    ],
  },
  {
    id: 'student',
    icon: '🎓',
    title: '학생기록 AI',
    samples: [
      {
        title: '행동특성 및 종합의견 — 김서준',
        fields: [
          { label: '학생 이름 (공통)', value: '김서준, 이지아, 박민준, 최수아, 정도윤' },
          { label: '김서준 관찰 내용', value: '학급 회장으로서 1년간 학급 행사를 적극적으로 기획하고 추진함. 운동회에서 반 전체를 격려하며 분위기를 이끌었고, 친구들 간 갈등이 생길 때 먼저 나서서 중재하는 모습을 자주 보임.' },
          { label: '이지아 관찰 내용', value: '매일 스스로 학습 계획표를 작성하고 꾸준히 실천하는 모습이 인상적임. 국어 독서록을 누구보다 꼼꼼하게 작성하였으며, 궁금한 것이 생기면 스스로 자료를 찾아보는 습관이 형성되어 있음.' },
          { label: '박민준 관찰 내용', value: '미술 시간마다 독창적인 아이디어로 주목받음. 모둠 활동에서 새로운 아이디어를 제안하는 역할을 자주 맡음. 다만 자신이 흥미를 느끼지 못하는 활동에서는 산만해지는 경향이 있어 지속적인 지도가 필요함.' },
          { label: '최수아 관찰 내용', value: '항상 수업 준비가 철저하며 과제 제출을 한 번도 빠트리지 않음. 급식 시간에 몸이 불편한 친구를 도와 식판을 들어주는 등 주변을 먼저 살피는 배려심이 뛰어남.' },
          { label: '정도윤 관찰 내용', value: '체육 시간에 처음 시도하는 활동에도 포기하지 않고 거듭 도전하는 모습이 돋보임. 수학 문제를 틀려도 스스로 풀이 과정을 다시 점검하는 태도를 가짐. 수업 중 발표는 소극적이나 소모둠 활동에서는 자신의 의견을 잘 표현함.' },
        ],
      },
      {
        title: '교과 세특 — 사회',
        fields: [
          { label: '교과목', value: '사회' },
          { label: '과제 1 (상/상/중/상/중)', value: '우리 지역의 역사 문화재 조사 보고서 작성' },
          { label: '과제 2 (상/중/중/중/하)', value: '지역 문제 해결 방안 토의 및 발표' },
          { label: '김서준 관찰', value: '과정: 국립청주박물관 방문 후 고인돌 유적지를 주제로 추가 자료를 직접 수집함\n태도: 발표 자료 준비에 모둠원보다 항상 한 발 앞서 솔선수범\n구체적 사례: 보고서에 직접 촬영한 사진과 도식을 포함해 완성도 높은 작품 제출' },
          { label: '이지아 관찰', value: '과정: 지역 도서관에서 자료를 추가로 찾아 보고서 내용을 충실하게 구성\n기능: 보고서의 목차 구성과 문장 표현이 또래 수준보다 우수\n구체적 사례: 토의 시간에 타인의 의견을 정리하는 데 강점을 보임' },
        ],
      },
      {
        title: '수업관찰기록 — 수학',
        fields: [
          { label: '교과', value: '수학' },
          { label: '학년/반', value: '5학년 2반' },
          { label: '단원', value: '4단원. 약분과 통분' },
          { label: '일시', value: '2026. 4. 15.(화) 3교시' },
          { label: '수업 교사', value: '박지은' },
          { label: '관찰 내용', value: '분수의 통분 방법을 설명하는 도입부에서 교사가 실물 화면에 수직선을 활용해 시각적으로 제시함. 학생들 대부분이 집중하며 이해하는 표정이었으나 일부 학생은 최소공배수 개념과 혼동하는 모습 보임. 모둠별 문제 풀이 활동에서 김서준이 모둠원에게 자신이 이해한 방법을 설명하며 또래 교수 효과가 나타남. 이지아는 풀이 과정을 꼼꼼히 적으며 체계적으로 접근. 박민준은 답은 맞히지만 풀이 과정 기록이 미흡하여 과정 서술 지도 필요. 수업 마무리 단계에서 개념 확인 퀴즈 5문항 실시 → 정답률 82%.' },
        ],
      },
      {
        title: '상담일지',
        fields: [
          { label: '상담 유형', value: '생활상담' },
          { label: '상담 일시', value: '2026. 4. 22. 13:00' },
          { label: '학생 이름', value: '박O준' },
          { label: '상담 참여자', value: '학생, 담임교사' },
          { label: '상담 내용', value: '모둠 활동 중 같은 반 친구와 의견 충돌이 있었고 며칠째 사이가 어색하다며 스스로 찾아와 이야기함. 자신이 아이디어를 냈는데 무시당한 느낌이 들어 속상하다고 표현. 교사가 상대방 입장에서 생각해볼 수 있도록 역할극 방식으로 대화를 나눔. 학생은 "그 친구도 나름대로 최선을 다한 것 같다"고 스스로 인식하는 모습 보임.' },
          { label: '후속 지원 계획', value: '다음 주 해당 학생들의 모둠 활동 태도 관찰 / 필요 시 두 학생 함께 중재 면담 진행 / 학부모 연락은 상황 추이 보며 결정' },
        ],
      },
      {
        title: '학급경영일지 — 5월 3주',
        fields: [
          { label: '날짜 범위', value: '2026. 5. 19.(월) ~ 5. 23.(금)' },
          { label: '주요 활동', value: '월: 사회 지역 문제 해결 모둠 토의 / 화: 수학 약분·통분 단원 형성평가 실시 / 수: 아침독서 + 과학 연소 실험(알코올램프 활용) / 목: 현장체험학습 사전교육(박물관 예절, 이동 경로 안내) / 금: 1학기 독서왕 중간 집계 발표, 영어 받아쓰기 퀴즈' },
          { label: '학생 특이사항', value: '박O준, 이O아 학생 간 모둠 활동 갈등 → 개별 상담 후 화해 / 최O아 학생 갑작스러운 복통으로 3교시 조기 귀가(학부모 인계 완료) / 정O윤 학생 수학 형성평가에서 전주 대비 성적 향상(70점→85점), 격려 스티커 수여' },
          { label: '담임 소감/메모', value: '현장체험학습이 다가오니 학생들 기대감이 높음. 과학 실험 수업에서 대부분 집중도가 높았고 안전 수칙도 잘 지킴. 이번 주는 학생들 간 갈등 중재에 시간이 많이 투입되었으나 자연스럽게 해결되어 다행. 다음 주 체험학습 당일 안전 관리 집중 필요.' },
        ],
      },
    ],
  },
  {
    id: 'lesson',
    icon: '📚',
    title: '수업자료 AI',
    samples: [
      {
        title: '프레젠테이션 슬라이드',
        fields: [
          { label: '교과', value: '사회' },
          { label: '단원', value: '2단원. 우리나라의 자연환경과 인문환경' },
          { label: '주제/수업명', value: '우리나라의 기후 특성과 생활 모습' },
          { label: '추가 요청사항', value: '각 슬라이드에 삽화 설명 포함 / 봄·여름·가을·겨울 계절별 생활 모습 각 1슬라이드씩 포함 / 마지막 슬라이드는 핵심 정리 / 슬라이드 수 6장' },
        ],
      },
      {
        title: '학습지 (활동형)',
        fields: [
          { label: '교과', value: '수학' },
          { label: '단원', value: '4단원. 약분과 통분' },
          { label: '주제/수업명', value: '분모가 다른 분수의 크기 비교' },
          { label: '추가 요청사항', value: '통분하여 크기 비교하는 단계적 문제 / 수직선 그림 활용 활동 포함 / 마지막 활동은 실생활 연계 스토리 문제 / 활동 수 3개' },
        ],
      },
      {
        title: '퀴즈',
        fields: [
          { label: '교과', value: '과학' },
          { label: '단원', value: '3단원. 연소와 소화' },
          { label: '주제/수업명', value: '연소의 조건과 소화 방법' },
          { label: '추가 요청사항', value: '객관식 5문항 + O/X 3문항 / 난이도 하~중 위주 / 실험 내용과 연계된 문항 포함' },
        ],
      },
      {
        title: '수업 계획서 (지도안)',
        fields: [
          { label: '교과', value: '국어' },
          { label: '단원', value: '6단원. 토의하여 해결해요' },
          { label: '주제/수업명', value: '토의 절차에 따라 학급 문제 해결하기' },
          { label: '추가 요청사항', value: '도입-전개-정리 3단계 구성 / 모둠 토의 활동 포함 / 형성평가 체크리스트 포함 / 45분 수업 기준' },
        ],
      },
    ],
  },
  {
    id: 'chatbot',
    icon: '💬',
    title: 'AI 챗봇 & 공문분석',
    samples: [
      {
        title: '교무행정AI 챗봇 — 예시 질문',
        fields: [
          { label: '질문 1', value: '학교폭력 신고를 받은 경우 담임교사가 가장 먼저 해야 할 절차를 알려줘.' },
          { label: '질문 2', value: '2026 개정 교육과정에서 초등학교 5학년 사회 과목의 주요 변경 사항이 무엇인지 정리해줘.' },
          { label: '질문 3', value: '학부모 상담 주간 운영 방법과 효과적인 상담 기록 방법을 알려줘.' },
        ],
      },
      {
        title: '공문 요약 / 업무 추출 — 샘플 공문',
        note: '"텍스트 직접 입력" 탭에 아래 내용을 붙여넣어 시연',
        fields: [
          {
            label: '샘플 공문 (전체)',
            value: `수신 충북초등학교장
(경유)
제목 2026학년도 학생정서·행동특성검사 실시 계획 알림

1. 관련: 충청북도교육청 학교생활교육과-3721(2026. 3. 10.)「2026학년도 학생 마음건강 지원 계획」
2. 위 호와 관련하여 2026학년도 학생정서·행동특성검사를 아래와 같이 실시하오니 학교 업무 담당자는 일정에 차질 없도록 협조하여 주시기 바랍니다.

  가. 대상: 초등 1·4학년, 중1, 고1 전학생
  나. 기간: 2026. 4. 7.(월) ~ 5. 9.(금)
  다. 방법: 학교 내 온라인(문자알림 서비스 활용) 또는 지면 검사
  라. 절차
    1) 3. 31.(월)까지: 학교 업무포털 내 검사 환경 설정 및 학생 명단 확인
    2) 4. 7.(월)부터: 학생·학부모 문자 발송 후 검사 실시
    3) 5. 9.(금)까지: 검사 완료 및 결과 등록
  마. 유의사항
    - 미검사 학생은 5. 14.(수)까지 추가 검사 실시
    - 2차 평가 대상자는 학교 상담교사 연계 필수
    - 결과는 학교생활기록부에 기재하지 않음

  붙임 1. 2026학년도 학생정서·행동특성검사 실시 요령 1부.
         2. 1·2차 평가 판정 기준 안내문 1부.  끝.

충청북도○○교육지원청교육장`,
          },
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
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-all ${
        copied
          ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 border border-green-300 dark:border-green-700'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-300 border border-gray-200 dark:border-gray-600'
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
    <div className="flex flex-col h-full bg-[#F5F7FA] dark:bg-gray-900 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-5 py-6 space-y-3">
        <div className="mb-4">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">시연 샘플</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">각 항목의 복사 버튼으로 입력칸에 붙여넣기 하세요.</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">가상 교사: <strong>박지은</strong> | 학교: <strong>충북초등학교</strong> | 학년/반: <strong>5학년 2반</strong></p>
        </div>

        {DEMO_DATA.map(cat => (
          <div key={cat.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleCategory(cat.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{cat.icon}</span>
                <span className="font-bold text-gray-800 dark:text-gray-100">{cat.title}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{cat.samples.length}</span>
              </div>
              {openCategories.has(cat.id)
                ? <ChevronDown className="w-4 h-4 text-gray-400" />
                : <ChevronRight className="w-4 h-4 text-gray-400" />
              }
            </button>

            {openCategories.has(cat.id) && (
              <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {cat.samples.map((sample, si) => {
                  const sampleKey = `${cat.id}-${si}`;
                  const isOpen = openSamples.has(sampleKey);
                  return (
                    <div key={si}>
                      <button
                        onClick={() => toggleSample(sampleKey)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-left"
                      >
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{sample.title}</span>
                        {isOpen
                          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        }
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-3 space-y-2">
                          {sample.note && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1">{sample.note}</p>
                          )}
                          {sample.fields.map((field, fi) => (
                            <div key={fi} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2.5">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{field.label}</span>
                                <CopyButton text={field.value} />
                              </div>
                              <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words">{field.value}</p>
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
