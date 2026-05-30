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
          { label: '제목 (건명)', value: '2026학년도 학생 AI 탐구 동아리 운영 계획' },
          { label: '본문 요청사항', value: '동아리명: AI탐구반 / 대상: 5~6학년 희망 학생 20명 / 운영 기간: 2026년 4월~11월 / 활동 시간: 매주 금요일 방과후 1시간 / 주요 활동: AI 기초 개념 학습, 이미지 생성 체험, 챗봇 활용 실습, 학기말 AI 작품 전시회 / 지도교사: 박지은 / 활용 기기: 학교 보유 태블릿 20대' },
        ],
      },
      {
        title: '계획서',
        fields: [
          { label: '주제/사업명', value: '2026학년도 학생 AI 탐구 동아리 운영 계획' },
          { label: '대상', value: '5~6학년 희망 학생 20명' },
          { label: '예산 (원)', value: '500,000' },
          { label: '추가 사항', value: '4~11월 운영 / 매주 금요일 방과후 1시간 / 학교 태블릿 20대 활용 / 월별 활동: AI 기초 개념(4~5월), 이미지 생성 체험(6월), 챗봇 실습(7~9월), 전시회 작품 제작(10월), 학기말 AI 작품 전시회(11월) / 지도교사: 박지은' },
        ],
      },
      {
        title: '보고서',
        fields: [
          { label: '주제/사업명', value: '2026학년도 학생 AI 탐구 동아리 운영 결과 보고' },
          { label: '대상', value: '5~6학년 20명' },
          { label: '예산/집행액', value: '계획액 500,000원 / 집행액 483,000원' },
          { label: '운영 결과', value: '4~11월 총 8개월 24회 운영 완료 / AI 기초 4회, 이미지 생성 6회, 챗봇 실습 6회, 전시회 준비 4회, 작품 전시회 1회 개최 / 전시회 전교생 150명 관람 / 참가 학생 전원 활동 완주' },
          { label: '추가 사항', value: '학부모 설문 만족도 4.8점(5점 만점) / 참가 인원 확대 요청 다수 / 내년 동아리 지원 예산 확대 및 외부 AI 강사 초청 검토 필요' },
        ],
      },
      {
        title: '품의서 — 물품 구입',
        fields: [
          { label: '품의 제목/건명', value: '2026학년도 학생 AI 탐구 동아리 운영 소모품 구입' },
          { label: '관련 공문/근거', value: '2026학년도 학생 AI 탐구 동아리 운영 계획' },
          { label: '소요 예산', value: '250,000' },
          { label: '산출 내역', value: '인쇄 용지 2박스 × 25,000원 + 색인 스티커 10팩 × 5,000원 + 마커 세트 10개 × 8,000원 + 동아리 명찰 20개 × 1,500원 = 250,000원' },
          { label: '세부 내역', value: '인쇄 용지(A4) 2박스, 색인 스티커 10팩, 마커 세트 10개, 동아리 명찰 20개' },
          { label: '구입 목적', value: 'AI 탐구 동아리 실습 활동 및 학기말 AI 작품 전시회 운영 준비' },
        ],
      },
      {
        title: '협의록',
        fields: [
          { label: '회의 제목', value: '2026학년도 학생 AI 탐구 동아리 운영 협의회' },
          { label: '학교명', value: '충북초등학교' },
          { label: '일시', value: '2026. 3. 12.(목) 16:00 ~ 17:00' },
          { label: '장소', value: '교무실' },
          { label: '출석위원', value: '교장, 교감, 교무부장, 담당교사 2명 (총 5명)' },
          { label: '회의 안건', value: '2026학년도 학생 AI 탐구 동아리 운영 계획 검토' },
          { label: '회의 내용 요약', value: '박지은 교사가 AI 탐구 동아리 연간 운영 계획 발표 / 교감이 디지털 기기 확보 여부 확인 요청 → 담당교사가 학교 보유 태블릿 20대 활용 가능 확인 / 교장이 학기말 AI 작품 전시회 전교생 공개 행사로 확대 운영 승인 / 참가 학생 모집 방법 논의 → 각 학급 홍보 후 희망자 선착순 20명 접수하기로 결정 / 모든 위원 이의 없이 원안 승인' },
        ],
      },
      {
        title: '가정통신문',
        fields: [
          { label: '제목', value: '학생 AI 탐구 동아리 참가자 모집 안내' },
          { label: '수신 대상', value: '5~6학년 학부모님' },
          { label: '안내 내용', value: '동아리명: AI탐구반 / 대상: 5~6학년 희망 학생 20명(선착순) / 운영 기간: 2026년 4월~11월 / 활동 시간: 매주 금요일 방과후 1시간 / 주요 활동: AI 기초 개념, 이미지 생성 체험, 챗봇 실습, 11월 AI 작품 전시회 / 신청 방법: 3월 20일(금)까지 담임교사에게 신청서 제출 / 문의: 교무실 043-000-0000' },
        ],
      },
      {
        title: '소통 메세지 — 학부모 SMS',
        fields: [
          { label: '전달 내용', value: 'AI탐구반 첫 활동이 4월 4일(금) 방과후 1시간 진행됩니다. 태블릿은 학교 것을 사용하므로 개인 기기 불필요합니다.' },
        ],
      },
      {
        title: '소통 메세지 — 학부모 LMS 답장',
        fields: [
          { label: '받은 메시지', value: '선생님, 저희 아이가 AI 동아리에 참가하고 싶다고 하는데 컴퓨터를 잘 못해도 괜찮을까요? 혹시 개인 노트북이 필요한지도 여쭤보고 싶습니다.' },
          { label: '답장 내용', value: '컴퓨터 실력과 무관하게 참여 가능하다는 점, 개인 기기 불필요하다는 점 안내. 따뜻하고 친절한 답장으로 작성.' },
        ],
      },
      {
        title: '공고문',
        fields: [
          { label: '공고 제목', value: '2026학년도 학생 AI 탐구 동아리 외부 강사 모집 공고' },
          { label: '공고 번호', value: '제2026-008호' },
          { label: '공고 내용 요약', value: '모집 인원: 1명 / 담당 분야: AI 기초 이론, 이미지 생성 실습, 챗봇 활용 지도 / 활동 일시: 매주 금요일 방과후 1시간(총 12회) / 기간: 2026년 4월~11월 / 대상 학생: 5~6학년 AI 탐구 동아리원 20명 / 자격: AI·SW 교육 관련 전공자 또는 유사 경력 2년 이상 / 활동비: 회당 50,000원(학교 예산)' },
          { label: '접수 기간/마감일', value: '2026. 3. 13.(금) ~ 2026. 3. 20.(금) 16:00까지' },
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
        title: '행동특성 및 종합의견',
        fields: [
          { label: '학생 이름 (공통)', value: '김서준, 이지아, 박민준, 최수아, 정도윤' },
          { label: '김서준 관찰 내용', value: 'AI 탐구 동아리 팀장으로 팀원 역할을 적절히 분배하고 협업을 이끄는 리더십을 발휘함. 전시회 준비 과정에서 전체 일정을 직접 기획하고 팀원을 격려하며 마무리함. 평소 학급에서도 갈등이 생길 때 먼저 나서서 중재하는 모습을 자주 보임.' },
          { label: '이지아 관찰 내용', value: 'AI 탐구 동아리 활동에서 매 회차 활동 내용을 꼼꼼하게 기록하고 복습하는 자기주도적 학습 태도가 두드러짐. 챗봇 실습 과정에서 가장 다양한 프롬프트를 시도하며 결과를 비교하는 탐구적 성향을 보임.' },
          { label: '박민준 관찰 내용', value: 'AI 이미지 생성 실습에서 독창적인 아이디어로 주목받음. 전시회 출품작으로 학교 사계절을 표현한 AI 이미지 연작을 제작하여 관람자들에게 호평을 받음. 자신이 흥미를 느끼는 활동에서는 집중력이 매우 높으나, 그렇지 않은 시간에는 산만해지는 경향이 있어 지속적인 지도가 필요함.' },
          { label: '최수아 관찰 내용', value: 'AI 탐구 동아리 전시회 준비에서 전시 공간 배치와 안내 자료 제작을 자원하여 맡음. 팀원의 의견을 경청하고 배려하는 태도가 뛰어나 모둠 분위기를 부드럽게 이끄는 역할을 함. 과제 제출이 한 번도 빠지지 않을 만큼 성실함.' },
          { label: '정도윤 관찰 내용', value: 'AI 탐구 동아리 초반 활동에서 디지털 도구 조작에 어려움을 겪었으나 포기하지 않고 꾸준히 연습하여 후반에는 챗봇 실습 활동에서 적극적으로 참여하는 모습을 보임. 어렵다고 느끼는 과제도 끝까지 완수하려는 끈기 있는 태도가 인상적임.' },
        ],
      },
      {
        title: '교과 세특 — 실과',
        fields: [
          { label: '교과목', value: '실과' },
          { label: '과제 1 (상/상/중/상/중)', value: 'AI 활용 사례 조사 보고서 작성' },
          { label: '과제 2 (상/중/중/중/하)', value: 'AI 윤리 딜레마 토의 및 발표' },
          { label: '김서준 관찰', value: '과정: AI 활용 사례를 의료·예술·교육 분야로 나누어 체계적으로 조사하고 시각 자료를 포함한 보고서 제출\n태도: 모둠 토의에서 근거를 들어 자신의 의견을 논리적으로 제시\n구체적 사례: AI 탐구 동아리 이미지 생성 체험을 사례로 들어 보고서 내용을 구체화함' },
          { label: '이지아 관찰', value: '과정: AI 윤리 토의에서 딥페이크 문제를 주제로 선택하여 관련 자료를 자발적으로 추가 수집\n기능: 보고서 논리 구성과 문장 표현이 또래 수준보다 우수\n구체적 사례: 토의 후 "AI를 잘 사용하는 것이 중요하다"는 핵심 결론을 모둠 대표로 발표함' },
        ],
      },
      {
        title: '수업관찰기록 — AI 탐구 동아리',
        fields: [
          { label: '교과', value: 'AI 탐구 동아리' },
          { label: '학년/반', value: '5~6학년 AI탐구반' },
          { label: '단원', value: '이미지 생성 AI 체험 실습' },
          { label: '일시', value: '2026. 6. 5.(금) 방과후' },
          { label: '수업 교사', value: '박지은' },
          { label: '관찰 내용', value: '이미지 생성 AI 도구를 활용해 학생들이 직접 프롬프트를 작성하는 실습 진행. 교사가 "원하는 장면을 글로 설명하면 그림이 만들어진다"고 도입부에서 안내하자 학생들이 호기심을 보임. 박민준이 가장 먼저 다양한 프롬프트를 시도하며 결과물을 비교하고 친구들에게 공유. 이지아는 영어 프롬프트와 한국어 프롬프트 결과를 비교하는 탐구적 접근을 보임. 정도윤은 초반에 어떤 글을 입력해야 할지 몰라 어려워했으나 김서준의 도움으로 자신만의 작품을 완성함. 활동 마무리에서 "AI가 만든 그림도 내 작품일까?"라는 질문으로 AI 윤리 토의로 자연스럽게 연결.' },
        ],
      },
      {
        title: '상담일지',
        fields: [
          { label: '상담 유형', value: '학습상담' },
          { label: '상담 일시', value: '2026. 9. 18. 13:30' },
          { label: '학생 이름', value: '정O윤' },
          { label: '상담 참여자', value: '학생, 담임교사' },
          { label: '상담 내용', value: 'AI 탐구 동아리 챗봇 실습에서 다른 친구들보다 결과물이 부족하다며 스스로 찾아와 "나는 AI를 잘 못하는 것 같다"고 말함. 교사가 초반 활동과 현재를 비교하며 성장한 부분을 구체적으로 짚어주자 학생이 "그러고 보니 처음보다는 많이 나아진 것 같다"고 인식하는 모습 보임. 남은 동아리 활동에서 전시회 출품작 완성이라는 구체적 목표를 함께 설정함.' },
          { label: '후속 지원 계획', value: '다음 동아리 활동 시 개별 피드백 강화 / 출품작 제작 과정에서 단계별 점검 진행 / 격려 스티커 수여로 성취감 제공' },
        ],
      },
      {
        title: '학급경영일지 — 10월 2주',
        fields: [
          { label: '날짜 범위', value: '2026. 10. 12.(월) ~ 10. 16.(금)' },
          { label: '주요 활동', value: '월: 실과 AI 윤리 토의 수업 / 화: 국어 발표 단원 모둠 발표 준비 / 수: 수학 분수 단원 형성평가 실시 / 목: AI 작품 전시회 사전 안내 및 전시 장소 배치 협의 / 금: AI 탐구 동아리 — 전시회 출품작 최종 점검 및 수정' },
          { label: '학생 특이사항', value: '정O윤 학생 동아리 활동에서 꾸준한 성장 확인, 전시 출품작 완성 / 박O준 학생 AI 이미지 작품 학교 대표작으로 선정되어 전교생 공개 전시 예정 / 이O아 학생 챗봇 프롬프트 비교 탐구 결과를 보고서로 정리하여 제출' },
          { label: '담임 소감/메모', value: '다음 달 AI 작품 전시회가 다가오면서 동아리 학생들의 집중도가 높아짐. 학급 전체도 동아리 활동에 관심을 보이며 비참가 학생들도 전시회를 기대하는 분위기. 실과 AI 윤리 수업과 동아리 활동이 자연스럽게 연결되어 학생들의 이해가 깊어지는 것을 체감함.' },
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
          { label: '교과', value: '실과' },
          { label: '단원', value: '5단원. 소프트웨어와 인공지능' },
          { label: '주제/수업명', value: '인공지능이란 무엇인가? — 우리 생활 속 AI 찾기' },
          { label: '추가 요청사항', value: '각 슬라이드에 실생활 예시 포함 / AI 활용 사례(스마트폰 추천, 번역기, 자율주행) 각 1슬라이드 / 마지막 슬라이드는 AI 윤리 생각해보기 / 슬라이드 수 6장' },
        ],
      },
      {
        title: '학습지 (활동형)',
        fields: [
          { label: '교과', value: '실과' },
          { label: '단원', value: '5단원. 소프트웨어와 인공지능' },
          { label: '주제/수업명', value: 'AI는 어떻게 학습할까? — 데이터와 학습의 개념 이해' },
          { label: '추가 요청사항', value: 'AI 학습 과정을 단계적으로 이해하는 활동 / 일상 속 AI 사례를 직접 써보는 활동 포함 / 마지막 활동은 "AI를 올바르게 사용하는 방법" 자유 서술 / 활동 수 3개' },
        ],
      },
      {
        title: '퀴즈',
        fields: [
          { label: '교과', value: '실과' },
          { label: '단원', value: '5단원. 소프트웨어와 인공지능' },
          { label: '주제/수업명', value: 'AI 기초 개념 및 윤리' },
          { label: '추가 요청사항', value: '객관식 5문항 + O/X 3문항 / 난이도 하~중 위주 / 실생활 AI 사례와 AI 윤리 관련 문항 포함' },
        ],
      },
      {
        title: '수업 계획서 (지도안)',
        fields: [
          { label: '교과', value: '실과' },
          { label: '단원', value: '5단원. 소프트웨어와 인공지능' },
          { label: '주제/수업명', value: 'AI 이미지 생성 도구 체험 — 프롬프트 작성과 결과 비교' },
          { label: '추가 요청사항', value: '도입-전개-정리 3단계 구성 / 모둠별 프롬프트 작성 및 결과 공유 활동 포함 / AI 윤리(저작권·딥페이크) 정리 포함 / 45분 수업 기준' },
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
          { label: '질문 1', value: 'AI 동아리를 처음 운영하려고 하는데, 연간 운영 계획에 꼭 포함해야 할 항목이 무엇인지 알려줘.' },
          { label: '질문 2', value: '초등학생 대상 AI 교육에서 다루어야 할 AI 윤리 주제와 지도 방법을 학년별로 정리해줘.' },
          { label: '질문 3', value: 'AI 탐구 동아리 학기말 작품 전시회를 준비할 때 담당 교사가 사전에 챙겨야 할 체크리스트를 만들어줘.' },
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
제목 2026학년도 학생 인공지능(AI) 교육 활성화 지원 계획 알림

1. 관련: 충청북도교육청 미래교육과-2156(2026. 2. 20.)「2026학년도 AI·디지털 교육 추진 계획」
2. 위 호와 관련하여 학생 인공지능 교육 활성화를 위한 지원 계획을 아래와 같이 안내하오니 관련 업무에 적극 활용하여 주시기 바랍니다.

  가. 지원 내용
    1) AI 교육 선도학교: 교당 최대 3,000,000원 교육 활동비 지원
    2) AI 동아리 운영학교: 교당 500,000원 동아리 활동비 지원
    3) AI 교육 담당교사 연수: 집합 연수 2회(4월, 9월) 실시
  나. 신청 방법
    1) 신청 기간: 2026. 3. 4.(수) ~ 3. 14.(금)
    2) 제출 서류: 운영 계획서 1부(별지 서식 활용)
    3) 제출처: 학교 업무포털 공문 접수
  다. 유의사항
    - AI 선도학교와 AI 동아리 지원은 중복 신청 불가
    - 운영 결과 보고서 제출: 2026. 11. 30.까지
    - 예산 집행 후 증빙 서류 보관 필수

  붙임 1. 2026학년도 학생 AI 교육 지원 사업 안내문 1부.
         2. AI 동아리 운영 계획서 서식 1부.  끝.

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
