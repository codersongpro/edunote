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
  - 예산 집행 증빙 자료 보관 필수`,
          },
        ],
      },
      {
        title: '공문서 작성기 - 내부결재 공문',
        fields: [
          { label: '제목', value: '2026학년도 학생 AI 탐구 동아리 운영 계획' },
          { label: '본문 요청사항', value: '대상은 5~6학년 희망 학생 20명, 운영 기간은 2026년 4월부터 11월까지, 활동 시간은 매주 금요일 방과 후 1시간입니다. 주요 활동은 AI 기초 개념 학습, 이미지 생성 체험, 챗봇 활용 실습, 학생 AI 작품 전시회 준비입니다.' },
        ],
      },
      {
        title: '공문서 작성기 - 가정통신문',
        fields: [
          { label: '제목', value: '학생 AI 탐구 동아리 참가 신청 안내' },
          { label: '안내 내용', value: '5~6학년 희망 학생을 대상으로 AI 탐구 동아리를 운영합니다. 신청 기간은 3월 20일까지이며, 담임교사에게 신청서를 제출하면 됩니다. 활동은 매주 금요일 방과 후 1시간 진행됩니다.' },
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
          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-blue-900/50 hover:text-blue-700 dark:hover:text-blue-100 border border-slate-200 dark:border-slate-600'
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
    <div className="flex h-full flex-col overflow-y-auto bg-[#F5F7FA] dark:bg-slate-950">
      <div className="mx-auto w-full max-w-2xl space-y-3 px-5 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-black text-slate-900 dark:text-white">시연 샘플</h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">각 항목의 복사 버튼으로 입력칸에 붙여넣기 하세요.</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            가상 교사: <strong>박지은</strong> | 학교: <strong>충북초등학교</strong> | 학년/반: <strong>5학년 2반</strong>
          </p>
        </div>

        {DEMO_DATA.map(cat => (
          <div key={cat.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <button
              onClick={() => toggleCategory(cat.id)}
              className="w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="truncate font-bold text-slate-800 dark:text-slate-50">{cat.title}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-200">{cat.samples.length}</span>
                </div>
                {openCategories.has(cat.id)
                  ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-300" />
                  : <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-300" />
                }
              </div>
            </button>

            {openCategories.has(cat.id) && (
              <div className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-700 dark:border-slate-700">
                {cat.samples.map((sample, si) => {
                  const sampleKey = `${cat.id}-${si}`;
                  const isOpen = openSamples.has(sampleKey);
                  return (
                    <div key={sampleKey}>
                      <button
                        onClick={() => toggleSample(sampleKey)}
                        className="w-full px-4 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-100">{sample.title}</span>
                          {isOpen
                            ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-300" />
                            : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-300" />
                          }
                        </div>
                      </button>

                      {isOpen && (
                        <div className="space-y-2 px-4 pb-3">
                          {sample.note && (
                            <p className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-100">{sample.note}</p>
                          )}
                          {sample.fields.map((field, fi) => (
                            <div key={`${sampleKey}-${fi}`} className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-900/70">
                              <div className="mb-1 flex items-start justify-between gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300">{field.label}</span>
                                <CopyButton text={field.value} />
                              </div>
                              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 dark:text-slate-100">{field.value}</p>
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
