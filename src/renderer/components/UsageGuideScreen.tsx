import React, { useState } from 'react';
import { Key, Bot, FileText, BookOpen, ChevronDown, ChevronUp, ExternalLink, AlertTriangle } from 'lucide-react';

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title, icon, children, defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 text-sm text-gray-600 dark:text-gray-300 space-y-3 border-t border-gray-100 dark:border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
};

const Step: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
  <li className="flex gap-3">
    <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{n}</span>
    <span className="leading-relaxed">{children}</span>
  </li>
);

const UsageGuideScreen: React.FC = () => {
  const handleOpenLink = (url: string) => {
    window.electronAPI.openExternal(url);
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA] dark:bg-gray-900 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-6 py-8 space-y-4">

        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-black text-gray-900 dark:text-white">사용 방법</h2>
        </div>

        {/* 시작 전 */}
        <Section title="시작 전 준비 — Gemini API 키 발급" icon={<Key className="w-4 h-4 text-blue-500" />} defaultOpen>
          <ol className="space-y-2.5">
            <Step n={1}>
              <button onClick={() => handleOpenLink('https://aistudio.google.com')} className="text-blue-500 hover:underline inline-flex items-center gap-1">
                aistudio.google.com <ExternalLink className="w-3 h-3" />
              </button>
              {' '}에 접속합니다.
            </Step>
            <Step n={2}>구글 계정으로 로그인합니다. <span className="text-gray-400 dark:text-gray-500">(무료 Google 계정으로 충분합니다)</span></Step>
            <Step n={3}>좌측 메뉴에서 <strong>"API 키"</strong>를 클릭합니다. <span className="text-gray-400 dark:text-gray-500">(영문: "Get API key")</span></Step>
            <Step n={4}>우측 상단 <strong>"API 키 만들기"</strong> 버튼을 클릭해 키를 생성합니다.</Step>
            <Step n={5}>생성된 키(AIza…)를 복사한 뒤, 에듀노트 <strong>설정</strong> 화면의 API 키 입력란에 붙여넣고 저장합니다.</Step>
          </ol>
          <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-xs text-amber-700 dark:text-amber-400">
            무료 계정 기준 분당 15회 요청 제한이 있습니다. 일반적인 사용에는 충분합니다.
          </div>
        </Section>

        {/* 학생기록 AI */}
        <Section title="학생기록 AI 사용법" icon={<Bot className="w-4 h-4 text-blue-500" />}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">사이드바에서 <strong>학생기록 AI</strong> 섹션을 선택하세요. 처음 진입 시 학교급을 선택합니다.</p>
          <div className="space-y-3">
            <div>
              <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">학생기록AI 챗봇</p>
              <p className="text-xs leading-relaxed">2026 학교생활기록부 기재요령 기반 자유 대화형 챗봇입니다. 기재 금지 사항, 작성법, 예시 요청 등을 자유롭게 물어보세요.</p>
            </div>
            <div>
              <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">행동특성 및 종합의견 / 교과 세특 생성</p>
              <p className="text-xs leading-relaxed">학생 정보와 특이사항을 입력하면 학교급에 맞는 문구를 AI가 생성합니다. 반드시 검토 후 사용하세요.</p>
            </div>
            <div>
              <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">학교스포츠클럽 / 창체 특기사항</p>
              <p className="text-xs leading-relaxed">활동 내용을 입력하면 기재 형식에 맞는 문구를 생성합니다. CSV로 내보내기 기능을 지원합니다.</p>
            </div>
          </div>
        </Section>

        {/* 교무 AI */}
        <Section title="교무 AI 사용법" icon={<FileText className="w-4 h-4 text-teal-500" />}>
          <div className="space-y-3">
            <div>
              <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">공문서 작성기 (9종)</p>
              <p className="text-xs leading-relaxed">공문서·계획서·보고서·품의서·회의록·홍보자료·가정통신문·문자메시지·공고문을 AI가 생성합니다. 사이드바에서 문서 종류를 선택하면 바로 해당 탭으로 이동합니다.</p>
            </div>
            <div>
              <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">수업관찰기록 / 상담일지 / 학급경영일지</p>
              <p className="text-xs leading-relaxed">날짜, 학급, 주요 내용을 입력하면 문서를 생성합니다. HWPX 또는 TXT 파일로 저장할 수 있습니다.</p>
            </div>
            <div>
              <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">학생 메모 보드</p>
              <p className="text-xs leading-relaxed">학생별 메모를 작성하고 앱 재시작 후에도 유지됩니다. CSV로 내보내기 가능합니다.</p>
            </div>
            <div>
              <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">교육AI챗봇</p>
              <p className="text-xs leading-relaxed">교육 전반에 관한 자유 Q&A 챗봇입니다. 수업 설계, 학급 운영, 교육 정책 등 다양한 질문을 할 수 있습니다.</p>
            </div>
          </div>
        </Section>

        {/* 자주 묻는 질문 */}
        <Section title="자주 묻는 질문 (FAQ)" icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}>
          <div className="space-y-4">
            <div>
              <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">Q. API 키 테스트가 실패합니다.</p>
              <p className="text-xs leading-relaxed">키를 복사할 때 앞뒤 공백이 포함되지 않았는지 확인하세요. AIza로 시작하는 전체 키를 붙여넣어야 합니다. 인터넷 연결 상태도 확인하세요.</p>
            </div>
            <div>
              <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">Q. AI 생성 결과물을 그대로 사용해도 되나요?</p>
              <p className="text-xs leading-relaxed">아닙니다. AI가 생성한 내용은 <strong>반드시 교사가 직접 검토·수정</strong>해야 합니다. 학생 개인정보나 사실관계가 잘못될 수 있습니다.</p>
            </div>
            <div>
              <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">Q. HWPX 파일이 한글(HWP)에서 열리지 않습니다.</p>
              <p className="text-xs leading-relaxed">한컴오피스 2020 이상 또는 한글과컴퓨터 뷰어에서 열어보세요. 구버전 HWP는 HWPX를 지원하지 않을 수 있습니다.</p>
            </div>
            <div>
              <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">Q. 생성 속도가 느립니다.</p>
              <p className="text-xs leading-relaxed">Gemini API 무료 계정은 분당 15회 요청 제한이 있습니다. 연속으로 많이 생성하면 잠시 대기가 필요할 수 있습니다.</p>
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
};

export default UsageGuideScreen;
