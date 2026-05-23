import React, { useEffect, useState } from 'react';
import { Settings, BookOpen, Download, ChevronRight, ClipboardList, Mail, AlertTriangle, Info } from 'lucide-react';
import iconPng from '../assets/icon.png';

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  releaseUrl: string;
}

interface Props {
  onNavigate: (target: 'settings' | 'student' | 'admin' | 'guide') => void;
  darkMode: boolean;
}

const HomeScreen: React.FC<Props> = ({ onNavigate, darkMode }) => {
  const [version, setVersion] = useState('1.0.0');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    window.electronAPI.getVersion().then((v: string) => setVersion(v)).catch(() => {});
    window.electronAPI.checkUpdate().then((info: UpdateInfo) => setUpdateInfo(info)).catch(() => {});
    window.electronAPI.hasApiKey().then((k: boolean) => setHasKey(k)).catch(() => setHasKey(false));
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA] dark:bg-gray-900 overflow-y-auto">
      <div className="max-w-xl mx-auto w-full px-6 py-10 space-y-6">

        {/* Update banner */}
        {updateInfo?.hasUpdate && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-500 shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-300">
                새 버전 <strong>v{updateInfo.latestVersion}</strong>이 출시됐습니다. (현재 v{updateInfo.currentVersion})
              </p>
            </div>
            <button
              onClick={() => window.electronAPI.openExternal(updateInfo.releaseUrl)}
              className="shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
            >
              다운로드
            </button>
          </div>
        )}

        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl overflow-hidden shadow-lg mb-2">
            <img src={iconPng} alt="EduNote" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">EduNote</h1>
          <div className="flex items-center justify-center gap-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">v{version}</p>
            {updateInfo && !updateInfo.hasUpdate && (
              <span className="text-[11px] px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700 rounded-full font-semibold">
                최신 버전 ✓
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            교직원을 위한 AI 도우미<br />학생 생활기록부 · 교무 행정 문서를 AI가 도와드립니다.
          </p>
        </div>

        {/* API key warning — only shown if no key */}
        {hasKey === false && (
          <div className="animate-pulse bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-500 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Gemini API 키를 입력해 주세요</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                  API 키가 없으면 AI 기능을 사용할 수 없습니다.<br />
                  아래 <strong>설정</strong>에서 API 키를 입력하세요. (무료 발급 가능)
                </p>
                <button
                  onClick={() => onNavigate('settings')}
                  className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-300 underline"
                >
                  설정으로 바로가기 →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI 활용 안내 */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl p-4">
          <div className="flex gap-3 items-start">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              AI가 초안 문구를 제안합니다. 생성된 내용은 학생 특성에 맞게 <strong>검토·수정</strong>하여 활용해 주세요.
            </p>
          </div>
        </div>

        {/* Quick nav cards — 설정 + 사용방법 only */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate('guide')}
            className="group flex flex-col gap-3 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">사용 방법</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">API 키 발급, 기능 사용법, 자주 묻는 질문</p>
            </div>
            <ChevronRight className="w-4 h-4 text-purple-400 self-end group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => onNavigate('settings')}
            className={`group flex flex-col gap-3 p-5 bg-white dark:bg-gray-800 rounded-xl border-2 transition-all text-left hover:shadow-md ${
              hasKey === false
                ? 'border-amber-400 dark:border-amber-500 animate-pulse hover:border-amber-500'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${hasKey === false ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <Settings className={`w-5 h-5 ${hasKey === false ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-300'}`} />
            </div>
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">
                설정
                {hasKey === false && <span className="ml-1 text-amber-500 text-xs">⚠ 키 미설정</span>}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                {hasKey === false
                  ? 'API 키 입력이 필요합니다'
                  : 'Gemini API 키, 교사 정보, 학생 명단'}
              </p>
            </div>
            <ChevronRight className={`w-4 h-4 self-end group-hover:translate-x-1 transition-transform ${hasKey === false ? 'text-amber-400' : 'text-gray-400'}`} />
          </button>
        </div>

        {/* Survey */}
        <button
          onClick={() => window.electronAPI.openExternal('https://forms.gle/X7rRcFRnsGNSt1ZFA')}
          className="w-full flex items-center justify-between gap-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl p-4 text-left transition-all shadow-sm hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">앱 만족도 설문 참여하기</p>
              <p className="text-xs text-indigo-100 mt-0.5">소중한 의견이 더 나은 EduNote를 만듭니다 (1분 소요)</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-white/70 shrink-0" />
        </button>

        {/* Developer info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 text-center space-y-1">
          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Developed by 송동석</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Teacher · Data Analytics · App Developer</p>
          <a
            onClick={() => window.electronAPI.openExternal('mailto:dungst.me@gmail.com')}
            className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer mt-1"
          >
            <Mail className="w-3.5 h-3.5" />
            dungst.me@gmail.com
          </a>
          <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">협업 및 피드백 환영합니다</p>
        </div>

      </div>
    </div>
  );
};

export default HomeScreen;
