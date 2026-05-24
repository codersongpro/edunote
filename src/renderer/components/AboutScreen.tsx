import React, { useEffect, useState } from 'react';
import { BookOpen, Mail, ExternalLink, Info, Bot, FileText, Presentation, Heart, AlertTriangle, Shield, ClipboardList } from 'lucide-react';

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  releaseUrl: string;
}

const AboutScreen: React.FC = () => {
  const [version, setVersion] = useState('');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    window.electronAPI.getVersion().then((v: string) => setVersion(v)).catch(() => {});
    window.electronAPI.checkUpdate()
      .then((info: UpdateInfo) => setUpdateInfo(info))
      .catch(() => {});
  }, []);

  const openLink = (url: string) => window.electronAPI.openExternal(url);

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA] dark:bg-gray-900 overflow-y-auto">
      <div className="max-w-xl mx-auto w-full px-6 py-10 space-y-6">

        {/* App identity */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center shadow-sm">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-teal-500 shadow-lg mb-4">
            <span className="text-4xl">📚</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-1">EduNote</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">EduNote — 교직원을 위한 AI 도우미</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">v{version}</span>
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            주요 기능
          </h2>
          <div className="space-y-3">
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">교무행정AI</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">공문서(9종) · 수업관찰기록 · 상담일지 · 학급경영일지 · 학생 메모 보드 · 교육AI챗봇</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 mt-0.5">
                <Presentation className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">수업자료AI</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">슬라이드 · 학습지 · 퀴즈 · 수업계획서 자동 생성</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">학생기록AI</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">행동특성 · 교과세특 · 스포츠클럽 · 창체 문구 생성 · AI 챗봇</p>
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

        {/* Developer */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-4">
            <Heart className="w-4 h-4 text-red-400" />
            제작자 정보
          </h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-200">개발자</span>
              <span className="text-sm text-gray-600 dark:text-gray-300">송동석</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-200">직업</span>
              <span className="text-sm text-gray-600 dark:text-gray-300">Teacher · Data Analytics · App Developer</span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Mail className="w-4 h-4 text-gray-400" />
              <button
                onClick={() => openLink('mailto:dungst.me@gmail.com')}
                className="text-sm text-blue-500 hover:text-blue-700 dark:hover:text-blue-300"
              >
                dungst.me@gmail.com
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 leading-relaxed">협업 및 피드백을 환영합니다. 교육 현장에서의 AI 활용을 더욱 넓혀가겠습니다.</p>
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
              { icon: '②', title: '개인정보 입력 금지', desc: '학생·학부모·교직원의 실명, 연락처 등 민감 정보를 입력하지 마세요. 이니셜 또는 가명을 사용하세요.' },
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

        {/* License */}
        <div className="text-center text-xs text-gray-400 dark:text-gray-500 pb-4 space-y-1">
          <p>Copyright © 2026 송동석. All rights reserved.</p>
          <p>Built with Electron · React · Google Gemini API</p>
        </div>

      </div>
    </div>
  );
};

export default AboutScreen;
