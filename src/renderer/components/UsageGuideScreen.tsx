import React, { useState } from 'react';
import {
  AlertTriangle,
  Bot,
  BookOpen,
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Key,
  Presentation,
  Settings,
  Upload,
  Video,
  Wrench,
} from 'lucide-react';
import { GEMINI_API_CLOUD_FALLBACK_STEPS, GEMINI_API_GUIDE_STEPS, GEMINI_API_GUIDE_VIDEO_URL } from '../lib/apiKeyGuide';
import { ApiKeyScopeNotice } from './ApiKeyScopeNotice';

const USAGE_GUIDE_VIDEO_URL = 'https://drive.google.com/file/d/1D1sdb3qvuxFv2BcrNPSILhMsjU0WgM9Q/view?usp=drive_link';

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title,
  icon,
  children,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-[#221E1B] rounded-xl border border-[#EDE8E1] dark:border-[#2E2822] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="font-bold text-[#1C1917] dark:text-[#F0EBE6] text-sm">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[#A8A29E]" /> : <ChevronDown className="w-4 h-4 text-[#A8A29E]" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 text-sm text-[#78716C] dark:text-[#9C8F87] space-y-3 border-t border-[#EDE8E1] dark:border-[#2E2822]">
          {children}
        </div>
      )}
    </div>
  );
};

const Step: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
  <li className="flex gap-3">
    <span className="flex-shrink-0 w-5 h-5 bg-blue-500 dark:bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">{n}</span>
    <span className="leading-relaxed">{children}</span>
  </li>
);

const UsageGuideScreen: React.FC = () => {
  const handleOpenLink = (url: string) => {
    window.electronAPI.openExternal(url);
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF9F7] dark:bg-[#171210] overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-6 py-8 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-black text-[#1C1917] dark:text-[#F0EBE6]">사용 방법</h2>
        </div>

        <button
          onClick={() => handleOpenLink(USAGE_GUIDE_VIDEO_URL)}
          className="w-full py-2.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-[#221E1B] text-sm font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30 flex items-center justify-center gap-1.5"
        >
          <Video className="w-4 h-4" /> 에듀노트 전체 사용법 보기 (영상)
        </button>

        <Section title="API 키 없이 쓸 수 있는 기능" icon={<Key className="w-4 h-4 text-emerald-500" />} defaultOpen>
          <ApiKeyScopeNotice />
        </Section>

        <Section title="시작 전 준비 - Gemini API 키 발급" icon={<Key className="w-4 h-4 text-blue-500" />} defaultOpen>
          <ol className="space-y-2.5">
            {GEMINI_API_GUIDE_STEPS.map((step, index) => (
              <Step key={step} n={index + 1}>
                {index === 0 ? (
                  <>
                    {step}{' '}
                    <button onClick={() => handleOpenLink('https://aistudio.google.com')} className="text-blue-500 hover:underline inline-flex items-center gap-1">
                      열기 <ExternalLink className="w-3 h-3" />
                    </button>
                  </>
                ) : step}
              </Step>
            ))}
          </ol>
          <button
            onClick={() => handleOpenLink(GEMINI_API_GUIDE_VIDEO_URL)}
            className="w-full py-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-[#221E1B] text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center justify-center gap-1.5"
          >
            <Video className="w-3.5 h-3.5" /> 키 발급 도움받기 (영상)
          </button>
          <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-xs text-amber-700 dark:text-amber-400">
            무료 API는 요청 제한이 있습니다. 토큰 소모나 잦은 요청으로 대기가 필요하면 앱이 안내합니다.
          </div>
          <div className="mt-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
            <p className="font-bold mb-1">프로젝트가 하나도 없을 때</p>
            <p>
              Google AI Studio의 <strong>프로젝트</strong> 메뉴에서 <strong>프로젝트 만들기</strong>를 누르고 이름을 <strong>edunote</strong>로 입력하세요.
              만든 뒤 <strong>프로젝트 가져오기(Select a Cloud Project)</strong>에서 <strong>edunote</strong>를 선택하고 <strong>키 만들기</strong>로 API 키를 생성하면 됩니다.
            </p>
          </div>
          <div className="mt-2 p-3 bg-slate-50 dark:bg-[#171210] border border-slate-200 dark:border-[#2E2822] rounded-lg text-xs text-[#78716C] dark:text-[#9C8F87] leading-relaxed">
            <p className="font-bold text-[#44403C] dark:text-[#F0EBE6] mb-1">Google Cloud 대안 방법</p>
            <ol className="space-y-1.5 pl-4 list-decimal">
              {GEMINI_API_CLOUD_FALLBACK_STEPS.map(step => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </Section>

        <Section title="개인정보보호와 저장 방식" icon={<AlertTriangle className="w-4 h-4 text-emerald-500" />}>
          <ul className="text-xs space-y-2 leading-relaxed text-[#78716C] dark:text-[#9C8F87]">
            <li>• 기본 정보, 학생 명단, 학생 메모, 생성 이력, 나만의 자료실 등 앱 자료는 암호화 없이 이 컴퓨터에 저장됩니다.</li>
            <li>• 백업 파일에도 위 자료가 암호화 없이 포함되니 USB·클라우드 보관 시 주의하세요. Gemini API 키만 예외로 암호화 보관되며 백업에 포함되지 않습니다.</li>
            <li>• 저장된 API 키는 보안상 화면에 다시 표시하지 않으며, 변경할 때만 새 키를 입력합니다.</li>
            <li>• 개인정보 보호 모드를 켜면 AI에게 보내기 전 학생 이름을 임시 표현으로 바꾸고 결과에서 되돌립니다. 다만 이름만 가려질 뿐 상담 내용 등 다른 정보는 그대로 전송되며, 성적 파일·사진 분석 등 일부 기능에는 적용되지 않습니다.</li>
            <li>• 학생·학부모·교직원의 연락처, 주민등록번호, 건강 정보 등 민감정보는 꼭 필요한 경우가 아니면 입력하지 마세요.</li>
            <li>• 무료 등급 API 키는 입력 내용이 구글의 서비스 개선에 활용될 수 있습니다. 유료 등급은 그렇지 않습니다.</li>
          </ul>
        </Section>

        <Section title="예산안작성" icon={<FileText className="w-4 h-4 text-green-600" />}>
          <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">AI가 예산 제목과 희망 물품을 분석해 어울리는 품목과 단가·수량을 자동으로 생성합니다.</p>
          <div className="space-y-3">
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">예산안 만들기</p>
              <ol className="space-y-1.5">
                <Step n={1}>예산 제목과 총 예산 금액을 입력합니다. 제목이 구체적일수록 주제에 맞는 품목이 생성됩니다.</Step>
                <Step n={2}><strong>과목별(비율)</strong> 방식은 교육운영비·일반운영비·업무추진비 비율을 지정하고, <strong>일반 작성</strong> 방식은 과목 없이 품목 중심으로 예산안을 만듭니다.</Step>
                <Step n={3}>희망 물품 칸에 원하는 품목을 입력하면 해당 품목이 우선 포함됩니다.</Step>
                <Step n={4}><strong>예산안 만들기</strong> 버튼을 누르면 Gemini가 제목 주제를 먼저 분석해 관련 품목만 생성합니다. 단가는 천원(1,000원) 단위로 생성됩니다.</Step>
              </ol>
            </div>
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">0원 맞추기</p>
              <ol className="space-y-1.5">
                <Step n={1}>예산안 생성 후 남은예산이 0이 아닐 때 사용합니다. <strong>0원 맞추기</strong> 버튼을 누르면 품목 수량을 자동 조절해 남은예산을 최대한 0원에 맞춥니다.</Step>
                <Step n={2}><strong>최소수량·최대수량 지정:</strong> 각 품목 행의 최소수량·최대수량 칸을 채우면 그 범위 안에서만 수량이 조절됩니다. 수량을 직접 수정하면 해당 품목이 잠금 상태가 되어 자동 조절 대상에서 제외됩니다.</Step>
                <Step n={3}>결과가 만족스럽지 않으면 수량을 직접 조정한 뒤 다시 눌러보세요.</Step>
              </ol>
              <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg text-xs text-green-700 dark:text-green-400">
                최소·최대 수량을 지정하지 않으면 최소 1 ~ 상한 없음으로 처리됩니다.
              </div>
            </div>
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">품목 검색으로 추가</p>
              <p className="text-xs leading-relaxed">나라장터 인증키를 설정하면 종합쇼핑몰의 실제 계약 품목과 단가를 검색해 바로 추가할 수 있습니다. 상품에 마우스를 올리면 이미지를 미리볼 수 있습니다.</p>
              <p className="text-xs leading-relaxed mt-1">나라장터에 없는 시중 물품은 "웹 검색으로 시중 참고가 함께 조사"를 켜면 AI가 웹에서 가격을 찾아 출처 링크와 함께 보여줍니다(참고가 표시, 검색 건수만큼 요금 발생). "직접 검색하기" 버튼으로 쇼핑 검색 결과 창을 열어 가격을 눈으로 확인할 수도 있습니다. 창이 열리지 않으면 기본 브라우저로 자동 전환됩니다.</p>
            </div>
          </div>
        </Section>

        <Section title="교무행정AI" icon={<FileText className="w-4 h-4 text-emerald-500" />}>
          <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">학교 행정 업무와 공문 처리를 돕는 메뉴입니다. 메뉴 순서는 같은 카테고리 안에서 드래그 앤 드롭으로 바꿀 수 있습니다.</p>
          <div className="space-y-3">
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">교무행정AI 챗봇</p>
              <p className="text-xs leading-relaxed">교육 행정, 학교 업무, 수업 운영, 교육 정책 관련 질문을 자유롭게 할 수 있습니다.</p>
            </div>
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">공문요약·업무추출</p>
              <p className="text-xs leading-relaxed">공문 내용이나 파일, 스크린샷을 넣으면 핵심 요약, 해야 할 일, 마감/제출 정보, 발신/담당 정보를 정리합니다. 결과 화면에서 Google Calendar 일정 작성 화면을 바로 열거나 .ics 파일로 저장할 수 있습니다.</p>
            </div>
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">문서작성기</p>
              <p className="text-xs leading-relaxed">공문서, 계획서, 연수자료, 보고서, 품의서, 회의록, 홍보자료, 가정통신문, 문자&소통메시지, 공고문을 생성합니다. 필요한 경우 참고 자료 파일이나 스크린샷도 함께 넣을 수 있습니다.</p>
              <p className="text-xs leading-relaxed mt-1">연수자료는 계획서의 내용 구성이 아니라 1. → 가. → 1) → 가) 말머리 체계만 따릅니다. 제목·기관명·충실한 연수 내용은 항상 만들고, 상황별 사례와 판단·실제 대응 절차·현장 체크리스트·근거 자료는 사용자가 체크한 경우에만 개조식·명사형 문체로 작성합니다. 말머리 단계는 글자 크기와 들여쓰기로도 구분되어(대항목 16pt 굵게 → 중항목 13pt → 소항목 12.5pt → 세항목 12pt, 아래 단계일수록 더 들여쓰기) 화면과 저장 결과에 그대로 나타납니다.</p>
              <p className="text-xs leading-relaxed mt-1">교육 주제 옆 검색 버튼을 누르면 교육부·교육청 등 공공기관 사이트(go.kr)만 골라 검색한 결과가 별도 창으로 열립니다. 받은 자료를 참고 자료로 첨부하면 그대로 반영됩니다. "웹 검색으로 최신 자료 참조"를 켜면 AI가 직접 웹을 검색해 근거를 확인하고 참고한 자료 목록을 결과 화면에 표시합니다(검색 건수만큼 요금이 추가되어 기본은 꺼짐, 유료 키 권장).</p>
            </div>
          </div>
        </Section>

        <Section title="수업자료AI" icon={<Presentation className="w-4 h-4 text-amber-500" />}>
          <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">수업 준비와 교실 활동을 돕는 메뉴입니다. 메뉴 순서는 같은 카테고리 안에서 드래그 앤 드롭으로 바꿀 수 있습니다.</p>
          <div className="space-y-3">
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">수업자료 생성</p>
              <p className="text-xs leading-relaxed">학년, 교과, 성취기준, 단원, 주제를 입력해 슬라이드, 워크시트, 퀴즈 앱, 수업 계획서, 교육용 게임 HTML을 생성합니다. 퀴즈와 게임은 시작 버튼이 포함된 단일 HTML 파일로 저장할 수 있습니다.</p>
            </div>
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">수업 도구</p>
              <p className="text-xs leading-relaxed">클릭하면 서브메뉴가 펼쳐집니다.</p>
              <ul className="text-xs mt-1 space-y-1 ml-3">
                <li>• <strong>QR 메이커</strong> — 수업 링크, 안내 자료, 활동 페이지 주소를 QR 코드로 만들어 저장하거나 복사합니다.</li>
                <li>• <strong>럭키드로우</strong> — 설정에 저장한 학생 명단을 활용해 오늘의 주인공, 발표자, 칭찬 릴레이 대상을 선정합니다.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">나만의 자료실</p>
              <p className="text-xs leading-relaxed">링크와 YouTube 자료를 보관합니다. YouTube 링크는 가능한 경우 제목과 썸네일을 자동으로 불러옵니다.</p>
            </div>
          </div>
        </Section>

        <Section title="학생기록AI" icon={<Bot className="w-4 h-4 text-indigo-500" />}>
          <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">생활기록부와 학생 기록을 돕는 메뉴입니다. 처음 사용할 때 학교급을 선택하며, 홈 바로 아래의 학교급 변경 버튼에서 언제든 바꿀 수 있습니다.</p>
          <div className="space-y-3">
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">학생기록AI 챗봇</p>
              <p className="text-xs leading-relaxed">학생 기록 작성 기준, 기재 가능/불가 표현, 문장 개선 방향을 질문할 수 있습니다.</p>
            </div>
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">생기부도우미</p>
              <p className="text-xs leading-relaxed">클릭하면 서브메뉴가 펼쳐집니다.</p>
              <ul className="text-xs mt-1 space-y-1 ml-3">
                <li>• <strong>행발생성</strong> — 학생 관찰 내용과 특성을 바탕으로 행동특성 및 종합의견 초안을 생성합니다.</li>
                <li>• <strong>교과 세특 생성</strong> — 교과 활동, 수행평가, 성취 수준을 바탕으로 교과 세부능력 및 특기사항 문구를 생성합니다.</li>
                <li>• <strong>학교스포츠클럽</strong> — 스포츠클럽 활동 내용과 참여 태도를 바탕으로 기재 문구를 생성합니다.</li>
                <li>• <strong>창체 특기사항</strong> — 자율·동아리·봉사·진로 등 창의적 체험활동 특기사항 문구를 생성합니다.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">우리반기록</p>
              <p className="text-xs leading-relaxed">클릭하면 서브메뉴가 펼쳐집니다.</p>
              <ul className="text-xs mt-1 space-y-1 ml-3">
                <li>• <strong>수업관찰기록</strong> — 수업 관찰 내용과 교사 메모를 입력해 수업 관찰 기록 문서를 생성합니다.</li>
                <li>• <strong>상담일지</strong> — 상담 주제와 내용을 바탕으로 상담 기록을 정리합니다.</li>
                <li>• <strong>학급경영일지</strong> — 학급 운영 내용, 특이사항, 교사 메모를 학급경영일지 형태로 정리합니다.</li>
                <li>• <strong>학생 메모 보드</strong> — 학생별 메모를 저장하고 관리합니다. 앱 재시작 후에도 유지됩니다.</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-rose-600 dark:text-rose-400 mt-2">생성된 내용은 반드시 교사가 검토·수정해야 합니다.</p>
        </Section>

        <Section title="내 스킬" icon={<Wrench className="w-4 h-4 text-violet-500" />}>
          <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">자주 쓰는 AI 작업 패턴을 나만의 스킬로 만들어 저장하고, 동료 선생님과 공유할 수 있습니다.</p>
          <div className="space-y-3">
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">스킬 만들기</p>
              <ul className="text-xs space-y-1.5 ml-3">
                <li>• <strong>대화로 만들기</strong> — AI와 4단계 대화를 통해 스킬을 자동으로 생성합니다. 어떤 작업을 자동화할지, 어떤 입력이 필요한지, 결과 형식은 어떻게 할지 답하면 스킬 초안이 만들어집니다.</li>
                <li>• <strong>직접 만들기</strong> — 3단계 위저드로 스킬을 직접 설정합니다. ① 기본 정보(이름·설명·카테고리) → ② 입력 필드 구성(텍스트·여러 줄·파일 첨부) → ③ 프롬프트 작성. 프롬프트 단계에서 <strong>AI가 대신 써줘</strong> 버튼으로 초안을 자동 생성할 수 있습니다.</li>
                <li>• <strong>HTML 앱 만들기</strong> — 게임, 퀴즈, 인터랙티브 활동지 등 HTML 앱 형태의 스킬을 생성합니다.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">스킬 실행</p>
              <p className="text-xs leading-relaxed">스킬 카드의 <strong>실행</strong> 버튼을 누르면 입력 폼이 나타납니다. 입력값을 채우고 <strong>생성</strong>을 누르면 AI가 결과를 만들어 줍니다. 파일 첨부 필드는 PDF·이미지·HWPX를 지원하며, 최대 20개까지 한 번에 올릴 수 있습니다. 생성 중에는 <strong>취소</strong> 버튼으로 멈출 수 있습니다.</p>
            </div>
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">스킬 관리</p>
              <ul className="text-xs space-y-1 ml-3">
                <li>• <strong>수정</strong> — 스킬 이름·필드·프롬프트를 언제든 수정할 수 있습니다.</li>
                <li>• <strong>내보내기(<span className="font-mono">↓</span>)</strong> — 스킬을 JSON 파일로 저장합니다. 카카오톡·이메일로 공유하면 상대방이 내 스킬에 추가할 수 있습니다.</li>
                <li>• <strong>파일에서 가져오기</strong> — 받은 JSON 파일을 열어 내 스킬 목록에 추가합니다.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">스킬마켓 탭</p>
              <p className="text-xs leading-relaxed">동료 선생님이 공유한 스킬 목록을 볼 수 있습니다. <strong>내 스킬에 추가</strong> 버튼으로 원하는 스킬을 바로 가져올 수 있으며, 이미 추가된 스킬은 초록색으로 표시됩니다.</p>
              <p className="text-xs leading-relaxed mt-1">내 스킬을 목록에 올리려면 스킬 카드의 <strong>공유(<span className="font-mono">↗</span>)</strong> 버튼을 눌러 이름·소속·한 마디를 입력하고 2단계 안내에 따라 등록하세요.</p>
            </div>
          </div>
        </Section>

        <Section title="파일 업로드와 스크린샷 붙여넣기" icon={<Upload className="w-4 h-4 text-sky-500" />}>
          <p className="text-xs leading-relaxed">파일 업로드 영역에는 PDF, 이미지, TXT, HWPX 등을 끌어다 놓을 수 있습니다. 스크린샷을 복사한 뒤 업로드 박스를 클릭하고 <strong>Ctrl+V</strong>를 누르면 이미지 파일처럼 첨부됩니다.</p>
          <p className="text-xs leading-relaxed">공문 요약, 공문서 작성 참고자료 등 파일 업로드 박스가 있는 화면에서 같은 방식으로 사용할 수 있습니다.</p>
        </Section>

        <Section title="Google Calendar 일정 추가" icon={<CalendarPlus className="w-4 h-4 text-emerald-500" />}>
          <ol className="space-y-2.5 text-xs">
            <Step n={1}>공문요약·업무추출에서 공문을 분석합니다.</Step>
            <Step n={2}>분석 결과에서 마감일이나 제출 일정이 맞는지 확인합니다.</Step>
            <Step n={3}><strong>구글캘린더 추가</strong> 버튼을 누릅니다.</Step>
            <Step n={4}>브라우저에 Google Calendar 일정 작성 화면이 열리면 제목, 날짜, 내용을 확인하고 <strong>저장</strong>을 누릅니다.</Step>
          </ol>
          <div className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg text-xs text-emerald-700 dark:text-emerald-300">
            보안상 앱이 사용자의 Google 계정 권한을 직접 가져오지 않습니다. 그래서 완전 자동 저장 대신, 일정 작성 화면을 미리 채운 뒤 사용자가 저장만 누르는 방식으로 동작합니다.
          </div>
        </Section>

        <Section title="홈 화면 앱 상태" icon={<Settings className="w-4 h-4 text-[#78716C]" />}>
          <p className="text-xs leading-relaxed">홈 화면 상단에 앱 상태 4가지가 한 줄로 표시됩니다.</p>
          <ul className="text-xs space-y-1.5 ml-3 mt-2">
            <li>• <strong>API 키</strong> — 등록됨/필요. 미설정이면 AI 기능을 사용할 수 없습니다.</li>
            <li>• <strong>사용자 정보</strong> — 설정에서 교사 이름·소속기관을 입력했는지 여부입니다.</li>
            <li>• <strong>학생 정보</strong> — 설정에서 학생 명단을 입력했는지 여부입니다.</li>
            <li>• <strong>마지막 백업</strong> — 설정 → 전체 자료 백업을 누른 직후 시간이 즉시 반영됩니다.</li>
          </ul>
        </Section>

        <Section title="설정에서 미리 입력하면 좋은 정보" icon={<Settings className="w-4 h-4 text-[#78716C]" />}>
          <ul className="text-xs space-y-1.5 ml-4 text-[#78716C] dark:text-[#9C8F87]">
            <li>• <strong>이름:</strong> 교사명 자동 입력에 사용됩니다.</li>
            <li>• <strong>소속기관:</strong> 공문서와 일부 생성 결과에 반영됩니다.</li>
            <li>• <strong>학교급과 담당 학년/반:</strong> 학생기록과 수업 관련 결과의 기준으로 사용됩니다.</li>
            <li>• <strong>학생 명단:</strong> 수업자료, 럭키드로우, 학생 메모 등에서 불러올 수 있습니다.</li>
            <li>• <strong>저장 폴더:</strong> 결과물과 앱 데이터를 원하는 폴더에 저장할 수 있습니다.</li>
          </ul>
        </Section>

        <Section title="자주 묻는 질문" icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}>
          <div className="space-y-4">
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">Q. API 키가 있는데 홈 화면에서 키를 입력하라고 나옵니다.</p>
              <p className="text-xs leading-relaxed">무료/유료 API 선택 상태가 다를 때 생길 수 있어 수정했습니다. 그래도 반복되면 설정에서 현재 사용 방식과 저장된 키를 확인해 주세요.</p>
            </div>
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">Q. AI 생성 결과를 그대로 사용해도 되나요?</p>
              <p className="text-xs leading-relaxed">아니요. AI 결과는 초안입니다. 사실관계, 학생 개인정보, 학교 상황에 맞는 표현을 반드시 검토·수정해야 합니다.</p>
            </div>
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">Q. 여러 메뉴에서 동시에 생성할 수 있나요?</p>
              <p className="text-xs leading-relaxed">가능합니다. 다만 무료 API는 요청 제한이 있으므로 3~4개 이하의 동시 생성이 현실적인 안전선입니다.</p>
            </div>
            <div>
              <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">Q. Demo 버튼은 무엇인가요?</p>
              <p className="text-xs leading-relaxed">사이드바 하단의 Demo 버튼을 누르면 별도 창이 열립니다. 교무행정AI·수업자료AI·학생기록AI·내 스킬 등 주요 기능의 샘플 입력값이 카테고리별로 정리되어 있으며, 복사 버튼으로 바로 붙여넣을 수 있습니다. 문서작성기는 내부결재 공문·계획서·연수자료·보고서·품의서·협의록·보도자료·메세지·공고문·가정통신문 10종 샘플이 모두 포함되어 있습니다.</p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
};

export default UsageGuideScreen;
