import React, { useEffect, useState } from 'react';
import { Settings, BookOpen, Download, ChevronRight, ClipboardList, AlertTriangle, Info } from 'lucide-react';
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

const HomeScreen: React.FC<Props> = ({ onNavigate }) => {
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

        {/* 업데이트 알림 */}
        {updateInfo?.hasUpdate && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-500 shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-300">
                새 버전 <strong>v{updateInfo.latestVersion}</strong>이 출시되었습니다. (현재 v{updateInfo.currentVersion})
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

        {/* 앱 아이덴티티 */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl overflow-hidden shadow-lg mb-2">
            <img src={iconPng} alt="EduNote" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">EduNote</h1>
          <div className="flex items-center justify-center gap-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">v{version}</p>
            {updateInfo && !updateInfo.hasUpdate && (
              <span className="text-[11px] px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700 rounded-full font-semibold">
                최신 버전
              </span>
            )}
          </div>
          <p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed">
            교무 행정 · 수업 준비 · 학생 기록을 AI가 도와드립니다.
          </p>
        </div>

        {/* API 키 미설정 경고 */}
        {hasKey === false && (
          <div className="animate-pulse bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-500 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Gemini API 키를 입력해 주세요</p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                  설정에서 무료 Gemini API 키를 입력해야 AI 기능을 사용할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 주의 안내 */}
        <div className="bg-fuchsia-50 dark:bg-fuchsia-950/30 border-2 border-fuchsia-300 dark:border-fuchsia-700 rounded-xl p-4 shadow-sm shadow-fuchsia-100/60 dark:shadow-none">
          <div className="flex gap-3 items-start">
            <Info className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-300 shrink-0 mt-1" />
            <p className="text-sm text-fuchsia-900 dark:text-fuchsia-100 leading-relaxed">
              AI가 초안 문구를 제안합니다. 생성된 내용은 <strong className="font-black text-rose-600 dark:text-rose-300">반드시 검토·수정</strong>하여 활용해 주세요.
            </p>
          </div>
        </div>

        {/* 메뉴 바로가기 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate('settings')}
            className={`group flex flex-col gap-3 p-5 bg-white dark:bg-gray-800 rounded-xl border-2 transition-all text-left hover:shadow-md overflow-hidden ${
              hasKey === false
                ? 'border-amber-400 dark:border-amber-500 animate-pulse hover:border-amber-500'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${hasKey === false ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <Settings className={`w-5 h-5 ${hasKey === false ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-300'}`} />
            </div>
            <div className="min-w-0 w-full">
              <p className="font-bold text-gray-800 dark:text-gray-100 text-base">
                설정
                {hasKey === false && <span className="ml-1 text-amber-500 text-sm">키 미설정</span>}
              </p>
              {hasKey === false ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">API 키 입력이 필요합니다</p>
              ) : (
                <ul className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 space-y-0.5">
                  <li>Gemini API 키</li>
                  <li>교사 정보 입력</li>
                  <li>학생 정보 입력</li>
                </ul>
              )}
            </div>
            <ChevronRight className={`w-4 h-4 self-end shrink-0 group-hover:translate-x-1 transition-transform ${hasKey === false ? 'text-amber-400' : 'text-gray-400'}`} />
          </button>

          <button
            onClick={() => onNavigate('guide')}
            className="group flex flex-col gap-3 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition-all text-left overflow-hidden"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0 w-full">
              <p className="font-bold text-gray-800 dark:text-gray-100 text-base">사용 방법</p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 space-y-0.5">
                <li>API 키 발급</li>
                <li>기능 소개</li>
                <li>자주 묻는 질문</li>
              </ul>
            </div>
            <ChevronRight className="w-4 h-4 text-purple-400 self-end shrink-0 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* 앱 만족도 설문 */}
        <button
          onClick={() => window.electronAPI.openExternal('https://forms.gle/X7rRcFRnsGNSt1ZFA')}
          className="w-full flex items-center justify-between gap-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl p-4 text-left transition-all shadow-sm hover:shadow-md"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-white">앱 만족도 설문 참여하기</p>
              <p className="text-sm text-indigo-100 mt-0.5">소중한 의견이 더 나은 EduNote를 만듭니다 (1분 소요)</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-white/70 shrink-0" />
        </button>

      </div>
    </div>
  );
};

export default HomeScreen;
