import React, { useEffect, useState } from 'react';
import { BookOpen, ExternalLink, Info, Bot, FileText, Presentation, Heart, AlertTriangle, ClipboardList, Wrench, Scale, ChevronDown } from 'lucide-react';
import iconPng from '../assets/icon.png';

// 배포물에 포함되는 주요 오픈소스 구성요소 고지. 전체 목록·라이선스 전문은
// 앱과 함께 배포되는 THIRD-PARTY-NOTICES.md 파일에 담겨 있다.
const OPEN_SOURCE_NOTICES: { name: string; license: string; holder: string }[] = [
  { name: '@google/genai', license: 'Apache-2.0', holder: 'Google LLC' },
  { name: 'firebase', license: 'Apache-2.0', holder: 'Google LLC' },
  { name: 'hwpxlib (HWPX 빈 문서 골격)', license: 'Apache-2.0', holder: 'Neolord0 외' },
  { name: 'react · react-dom', license: 'MIT', holder: 'Meta Platforms, Inc.' },
  { name: 'electron-store', license: 'MIT', holder: 'Sindre Sorhus' },
  { name: 'qrcode', license: 'MIT', holder: 'Ryan Day' },
  { name: '@xmldom/xmldom', license: 'MIT', holder: 'Christopher J. Brody 외' },
  { name: 'react-markdown · remark · rehype', license: 'MIT', holder: 'Titus Wormer 외' },
  { name: 'jszip (MIT 선택)', license: 'MIT', holder: 'Stuart Knightley 외' },
  { name: 'pako', license: 'MIT AND Zlib', holder: 'Vitaly Puzrin · Andrei Tuputcyn' },
  { name: 'lucide-react', license: 'ISC', holder: 'Lucide Contributors' },
  { name: 'Pretendard 글꼴', license: 'OFL-1.1', holder: 'Kil Hyung-jin' },
];

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  releaseUrl: string;
}

const AboutScreen: React.FC = () => {
  const [version, setVersion] = useState('');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showOpenSource, setShowOpenSource] = useState(false);

  useEffect(() => {
    window.electronAPI.getVersion().then((v: string) => setVersion(v)).catch(() => {});
    window.electronAPI.checkUpdate()
      .then((info: UpdateInfo) => setUpdateInfo(info))
      .catch(() => {});
  }, []);

  const openLink = (url: string) => window.electronAPI.openExternal(url);

  return (
    <div className="flex flex-col h-full bg-[#FAF9F7] dark:bg-[#171210] overflow-y-auto">
      <div className="max-w-xl mx-auto w-full px-6 py-10 space-y-6">

        {/* App identity */}
        <div className="bg-white dark:bg-[#221E1B] rounded-2xl border border-[#EDE8E1] dark:border-[#2E2822] p-8 text-center shadow-sm">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
            <img src={iconPng} alt="EduNote" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-black text-[#1C1917] dark:text-[#F0EBE6] mb-1">EduNote</h1>
          <p className="text-sm text-[#78716C] dark:text-[#9C8F87] mb-3">EduNote — 교직원을 위한 AI 도우미</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm font-semibold text-[#44403C] dark:text-[#9C8F87]">v{version}</span>
            {updateInfo && !updateInfo.hasUpdate && (
              <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700 rounded-full font-semibold">
                최신 버전 ✓
              </span>
            )}
            {updateInfo?.hasUpdate && (
              <button
                onClick={() => openLink(updateInfo.releaseUrl)}
                className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold transition-colors"
              >
                v{updateInfo.latestVersion} 업데이트
              </button>
            )}
          </div>
        </div>

        {/* Feature list */}
        <div className="bg-white dark:bg-[#221E1B] rounded-2xl border border-[#EDE8E1] dark:border-[#2E2822] p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-[#1C1917] dark:text-[#F0EBE6] flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            주요 기능
          </h2>
          <div className="space-y-3">
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1C1917] dark:text-[#F0EBE6]">교무행정AI</p>
                <p className="text-xs text-[#78716C] dark:text-[#9C8F87] leading-relaxed">공문서(9종) · 공문요약·업무추출 · 교무행정AI 챗봇</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 mt-0.5">
                <Presentation className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1C1917] dark:text-[#F0EBE6]">수업자료AI</p>
                <p className="text-xs text-[#78716C] dark:text-[#9C8F87] leading-relaxed">슬라이드 · 학습지 · 퀴즈 · 수업계획서 자동 생성 · QR 메이커 · 럭키드로우 · 나만의 자료실</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1C1917] dark:text-[#F0EBE6]">학생기록AI</p>
                <p className="text-xs text-[#78716C] dark:text-[#9C8F87] leading-relaxed">생기부도우미(행발·세특·스포츠클럽·창체) · 우리반기록(수업관찰·상담일지·학급경영일지·학생 메모) · AI 챗봇</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0 mt-0.5">
                <Wrench className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1C1917] dark:text-[#F0EBE6]">내 스킬</p>
                <p className="text-xs text-[#78716C] dark:text-[#9C8F87] leading-relaxed">나만의 AI 스킬 만들기(위저드·대화형·HTML 앱) · 스킬 실행·수정·공유 · 스킬마켓</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            <strong>AI 엔진:</strong> Google Gemini API 기반으로 동작합니다. 개인 API 키(무료 발급 가능)를 사용하며, 생성된 결과물은 반드시 검토 후 활용해 주세요.
          </p>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-emerald-800 dark:text-emerald-200 mb-3">개인정보보호 안내</h2>
          <div className="space-y-2 text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
            <p>EduNote의 기본 정보, 학생 명단, 학생 메모, 생성 이력, 나만의 자료실 등 앱 자료는 암호화 없이 이 컴퓨터에 저장됩니다.</p>
            <p>Gemini API 키만 예외로 OS 안전 저장소에 암호화 보관되며, 백업 파일에도 포함되지 않습니다. 저장된 키는 보안상 화면에 다시 표시하지 않고 변경 시에만 새 키를 입력합니다.</p>
            <p>개인정보 보호 모드를 켜면 AI에게 보내기 전 학생 이름을 임시 표현으로 바꾸고 결과에서 되돌립니다. 다만 이름만 가려질 뿐 상담 내용 등 본문의 다른 정보는 그대로 전송되며, 성적 파일·사진 분석처럼 보호 모드가 적용되지 않는 기능도 있습니다.</p>
            <p>학생·학부모·교직원의 연락처, 주민등록번호, 건강 정보 등 민감정보는 꼭 필요한 경우가 아니면 입력하지 않는 것이 안전합니다.</p>
          </div>
        </div>

        {/* Developer */}
        <div className="bg-white dark:bg-[#221E1B] rounded-2xl border border-[#EDE8E1] dark:border-[#2E2822] p-6 shadow-sm">
          <h2 className="text-base font-bold text-[#1C1917] dark:text-[#F0EBE6] flex items-center gap-2 mb-4">
            <Heart className="w-4 h-4 text-red-400" />
            제작자 정보
          </h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">개발자</span>
              <span className="text-sm text-[#78716C] dark:text-[#9C8F87]">Dustin</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#78716C] dark:text-[#9C8F87]">Teacher · Data Analytics · App Developer</span>
            </div>
          </div>
          <p className="text-xs text-[#A8A29E] dark:text-[#6B5E57] mt-4 leading-relaxed">협업 및 피드백을 환영합니다. 교육 현장에서의 AI 활용을 더욱 넓혀가겠습니다.</p>
          <button
            onClick={() => openLink('https://forms.gle/X7rRcFRnsGNSt1ZFA')}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-50 hover:bg-violet-100 dark:bg-violet-900/30 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-700 rounded-xl text-sm font-semibold text-violet-700 dark:text-violet-300 transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            앱 만족도 설문 참여하기
            <ExternalLink className="w-3.5 h-3.5 opacity-60" />
          </button>
        </div>

        {/* Usage precautions */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            사용 시 주의사항
          </h2>
          <div className="space-y-3">
            {[
              { icon: '①', title: '반드시 검토 후 사용', desc: 'AI가 생성한 내용은 사실과 다를 수 있습니다. 담당자가 직접 검토·수정 후 사용해 주세요.' },
              { icon: '②', title: '민감 정보 최소 입력', desc: '학생·학부모·교직원의 연락처, 주민등록번호, 건강 정보 등은 꼭 필요한 경우가 아니면 입력하지 마세요. 학생 이름은 개인정보 보호 모드로 AI 전송 시 가릴 수 있습니다.' },
              { icon: '③', title: '최종 책임은 사용자에게', desc: '생성된 문서의 정확성과 법적 책임은 사용자 본인에게 있습니다.' },
              { icon: '④', title: '수업관찰·상담·학급경영 기록', desc: '교사의 직접 기록이 최우선입니다. AI는 형식 정리와 표현 보완을 보조할 뿐입니다.' },
            ].map(({ icon, title, desc }) => (
              <div key={icon} className="flex gap-3 items-start">
                <span className="text-sm font-black text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">{icon}</span>
                <div>
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-200">{title}</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Open source notices */}
        <div className="bg-white dark:bg-[#221E1B] rounded-2xl border border-[#EDE8E1] dark:border-[#2E2822] shadow-sm overflow-hidden">
          <button
            onClick={() => setShowOpenSource(v => !v)}
            className="w-full flex items-center gap-2 p-6 text-left"
          >
            <Scale className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-bold text-[#1C1917] dark:text-[#F0EBE6]">오픈소스 라이선스</h2>
            <ChevronDown className={`w-4 h-4 ml-auto text-[#A8A29E] transition-transform ${showOpenSource ? 'rotate-180' : ''}`} />
          </button>
          {showOpenSource && (
            <div className="px-6 pb-6 space-y-3">
              <p className="text-xs text-[#78716C] dark:text-[#9C8F87] leading-relaxed">
                EduNote는 아래 오픈소스 소프트웨어를 사용합니다. 각 구성요소는 해당 라이선스 조건에 따라 배포되며, 전체 목록과 라이선스 전문은 앱과 함께 배포되는 <span className="font-semibold">THIRD-PARTY-NOTICES.md</span> 파일에서 확인할 수 있습니다.
              </p>
              <div className="border border-[#EDE8E1] dark:border-[#2E2822] rounded-xl divide-y divide-[#EDE8E1] dark:divide-[#2E2822] max-h-64 overflow-y-auto">
                {OPEN_SOURCE_NOTICES.map(({ name, license, holder }) => (
                  <div key={name} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#44403C] dark:text-[#C4B8B0] truncate">{name}</p>
                      <p className="text-[11px] text-[#A8A29E] dark:text-[#6B5E57] truncate">{holder}</p>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">{license}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* License */}
        <div className="text-center text-xs text-[#A8A29E] dark:text-[#6B5E57] pb-4 space-y-1">
          <p>Copyright © {new Date().getFullYear()} Dustin. All rights reserved.</p>
        </div>

      </div>
    </div>
  );
};

export default AboutScreen;
