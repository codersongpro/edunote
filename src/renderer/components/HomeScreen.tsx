import React, { useEffect, useState } from 'react';
import { Settings, BookOpen, Bot, FileText, Mail, ChevronRight, AlertTriangle } from 'lucide-react';

interface Props {
  onNavigate: (target: 'settings' | 'student' | 'admin' | 'guide') => void;
  darkMode: boolean;
}

const HomeScreen: React.FC<Props> = ({ onNavigate, darkMode }) => {
  const [version, setVersion] = useState('1.0.0');

  useEffect(() => {
    window.electronAPI.getVersion().then((v: string) => setVersion(v)).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA] dark:bg-gray-900 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-6 py-10 space-y-8">

        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-teal-500 shadow-lg mb-2">
            <span className="text-3xl font-black text-white">에</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">에듀노트</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">v{version}</p>
          <p className="text-base text-gray-600 dark:text-gray-300 max-w-md mx-auto leading-relaxed">
            교사를 위한 AI 도우미 — 학생 생활기록부 작성부터 교무 행정 문서까지, Gemini AI가 도와드립니다.
          </p>
        </div>

        {/* AI 생성 경고 */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">AI 생성 문구 사용 시 주의사항</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                이 프로그램은 Google Gemini AI를 이용해 문구를 생성합니다. AI가 생성한 내용은 <strong>반드시 교사가 직접 검토·수정</strong>한 후 사용하세요.
                AI 생성 문구를 무검토로 학생부에 기재하는 것은 교육 현장의 책임 원칙에 어긋날 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {/* Quick nav cards */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate('student')}
            className="group flex flex-col gap-3 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">학생기록 AI</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">생활기록부 기재요령 Q&A, 행동특성·세특·스포츠클럽·창체 문구 생성</p>
            </div>
            <ChevronRight className="w-4 h-4 text-blue-400 self-end group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => onNavigate('admin')}
            className="group flex flex-col gap-3 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-teal-400 dark:hover:border-teal-500 hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
              <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">교무 AI</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">공문서·계획서·보고서 등 9종 문서, 수업관찰·상담·학급경영 기록</p>
            </div>
            <ChevronRight className="w-4 h-4 text-teal-400 self-end group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => onNavigate('guide')}
            className="group flex flex-col gap-3 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">사용 방법</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">API 키 발급 방법, 각 기능 사용법, 자주 묻는 질문</p>
            </div>
            <ChevronRight className="w-4 h-4 text-purple-400 self-end group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => onNavigate('settings')}
            className="group flex flex-col gap-3 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </div>
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">설정</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">Gemini API 키, 교사 정보, 저장 폴더 설정</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 self-end group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

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
