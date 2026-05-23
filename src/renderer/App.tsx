import React, { useState, useEffect } from 'react';
import { AppMode, SchoolLevel, DocType } from './types';
import { GlobalStateContext, initialGlobalState } from './GlobalStateContext';
import { GlobalState } from './types';

import SchoolLevelSelector from './components/SchoolLevelSelector';
import GuidelineQA from './components/GuidelineQA';
import RecordChatbot from './components/RecordChatbot';
import OpinionGenerator from './components/OpinionGenerator';
import SubjectGenerator from './components/SubjectGenerator';
import SportsClubGenerator from './components/SportsClubGenerator';
import CreativeActivityGenerator from './components/CreativeActivityGenerator';
import SchoolDocPanel from './components/SchoolDocPanel';
import LessonObservationGenerator from './components/LessonObservationGenerator';
import CounselingLogGenerator from './components/CounselingLogGenerator';
import ClassManagementLogGenerator from './components/ClassManagementLogGenerator';
import StudentMemoBoard from './components/StudentMemoBoard';
import EducationAssistantQA from './components/EducationAssistantQA';
import SettingsScreen from './components/SettingsScreen';

import {
  Bot, BookOpen, User2, Dumbbell, Palette, MessageSquareText,
  FileText, Eye, MessageCircle, CalendarDays, StickyNote, GraduationCap,
  Settings, ChevronDown, ChevronRight, School, Sun, Moon, File
} from 'lucide-react';

const STUDENT_RECORD_MODES: AppMode[] = [
  AppMode.RECORD_CHATBOT, AppMode.GUIDELINE_QA, AppMode.GENERATOR,
  AppMode.SUBJECT_GENERATOR, AppMode.SPORTS_CLUB_GENERATOR, AppMode.CREATIVE_ACTIVITY_GENERATOR,
];

const DOC_TYPE_LABELS: Record<DocType, string> = {
  [DocType.GONGMUN]: '공문서',
  [DocType.PLAN]: '계획서',
  [DocType.REPORT]: '보고서',
  [DocType.PUMUI]: '품의서',
  [DocType.MEETING_MINUTES]: '회의록',
  [DocType.PROMOTION]: '홍보자료',
  [DocType.NEWSLETTER]: '가정통신문',
  [DocType.MESSAGE]: '문자메시지',
  [DocType.GONGGO]: '공고문',
};

const ALL_DOC_TYPES = [
  DocType.GONGMUN, DocType.PLAN, DocType.REPORT, DocType.PUMUI,
  DocType.MEETING_MINUTES, DocType.PROMOTION, DocType.NEWSLETTER,
  DocType.MESSAGE, DocType.GONGGO,
];

const App: React.FC = () => {
  const [state, setState] = useState<GlobalState>(initialGlobalState);
  const [isGlobalGenerating, setIsGlobalGenerating] = useState(false);
  const [globalProgress, setGlobalProgress] = useState(0);

  const [mode, setMode] = useState<AppMode>(AppMode.SETTINGS);
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>(SchoolLevel.HIGH);
  const [showSchoolLevelModal, setShowSchoolLevelModal] = useState(false);
  const [hasEnteredStudentSection, setHasEnteredStudentSection] = useState(false);
  const [studentSectionOpen, setStudentSectionOpen] = useState(true);
  const [adminSectionOpen, setAdminSectionOpen] = useState(true);
  const [schoolDocSubOpen, setSchoolDocSubOpen] = useState(false);
  const [activeDocType, setActiveDocType] = useState<DocType>(DocType.GONGMUN);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const [hn, sl, dm] = await Promise.all([
          window.electronAPI.hasApiKey(),
          window.electronAPI.getConfig('schoolLevel'),
          window.electronAPI.getConfig('darkMode'),
        ]);
        setHasApiKey(hn as boolean);
        if (sl) setSchoolLevel(sl as SchoolLevel);
        setDarkMode(!!(dm as boolean));
        if (!(hn as boolean)) {
          setMode(AppMode.SETTINGS);
        } else {
          setMode(AppMode.RECORD_CHATBOT);
          setHasEnteredStudentSection(true);
        }
      } catch {
        setMode(AppMode.SETTINGS);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const toggleDarkMode = async () => {
    const next = !darkMode;
    setDarkMode(next);
    await window.electronAPI.setConfig({ darkMode: next });
  };

  const handleModeChange = (newMode: AppMode) => {
    if (STUDENT_RECORD_MODES.includes(newMode) && !hasEnteredStudentSection) {
      setShowSchoolLevelModal(true);
      setState(prev => ({ ...prev, _pendingMode: newMode } as any));
      return;
    }
    setMode(newMode);
  };

  const handleSchoolLevelSelect = (level: SchoolLevel) => {
    setSchoolLevel(level);
    setHasEnteredStudentSection(true);
    setShowSchoolLevelModal(false);
    const pendingMode = (state as any)._pendingMode;
    if (pendingMode) {
      setMode(pendingMode);
      setState(prev => { const s = { ...prev }; delete (s as any)._pendingMode; return s; });
    } else {
      setMode(AppMode.RECORD_CHATBOT);
    }
  };

  const handleSchoolDocNav = (docType: DocType) => {
    setMode(AppMode.SCHOOL_DOC);
    setActiveDocType(docType);
    setSchoolDocSubOpen(true);
  };

  const handleSchoolDocParent = () => {
    if (!schoolDocSubOpen) {
      setSchoolDocSubOpen(true);
      setMode(AppMode.SCHOOL_DOC);
    } else {
      setSchoolDocSubOpen(false);
    }
  };

  // Section-specific nav item classes
  const studentNavClass = (m: AppMode) =>
    `w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-all cursor-pointer ${
      mode === m
        ? 'bg-blue-600 text-white font-semibold shadow-sm'
        : 'text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300'
    }`;

  const adminNavClass = (m: AppMode, isDocParent = false) =>
    `w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-all cursor-pointer ${
      mode === m && !isDocParent
        ? 'bg-teal-600 text-white font-semibold shadow-sm'
        : isDocParent && mode === AppMode.SCHOOL_DOC
        ? 'bg-teal-600 text-white font-semibold shadow-sm'
        : 'text-gray-600 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-300'
    }`;

  const docSubNavClass = (dt: DocType) =>
    `w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-xs rounded-md transition-all cursor-pointer ${
      mode === AppMode.SCHOOL_DOC && activeDocType === dt
        ? 'bg-teal-500 text-white font-semibold'
        : 'text-gray-500 dark:text-gray-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-300'
    }`;

  const studentMenuItems = [
    { mode: AppMode.RECORD_CHATBOT, icon: Bot, label: 'AI 챗봇 도우미', badge: 'NEW' },
    { mode: AppMode.GUIDELINE_QA, icon: MessageSquareText, label: '기재요령 Q&A' },
    { mode: AppMode.GENERATOR, icon: User2, label: '행동특성 및 종합의견' },
    { mode: AppMode.SUBJECT_GENERATOR, icon: BookOpen, label: '교과 세특 생성' },
    { mode: AppMode.SPORTS_CLUB_GENERATOR, icon: Dumbbell, label: '학교스포츠클럽' },
    { mode: AppMode.CREATIVE_ACTIVITY_GENERATOR, icon: Palette, label: '창체 특기사항' },
  ];

  const adminMenuItems = [
    { mode: AppMode.LESSON_OBSERVATION, icon: Eye, label: '수업관찰기록' },
    { mode: AppMode.COUNSELING_LOG, icon: MessageCircle, label: '상담일지' },
    { mode: AppMode.CLASS_LOG, icon: CalendarDays, label: '학급경영일지' },
    { mode: AppMode.STUDENT_MEMO, icon: StickyNote, label: '학생 메모 보드' },
    { mode: AppMode.EDUCATION_QA, icon: GraduationCap, label: '교육 도우미 AI' },
  ];

  const renderContent = () => {
    switch (mode) {
      case AppMode.RECORD_CHATBOT: return <RecordChatbot schoolLevel={schoolLevel} />;
      case AppMode.GUIDELINE_QA: return <GuidelineQA schoolLevel={schoolLevel} />;
      case AppMode.GENERATOR: return <OpinionGenerator schoolLevel={schoolLevel} />;
      case AppMode.SUBJECT_GENERATOR: return <SubjectGenerator schoolLevel={schoolLevel} />;
      case AppMode.SPORTS_CLUB_GENERATOR: return <SportsClubGenerator schoolLevel={schoolLevel} />;
      case AppMode.CREATIVE_ACTIVITY_GENERATOR: return <CreativeActivityGenerator schoolLevel={schoolLevel} />;
      case AppMode.SCHOOL_DOC: return <SchoolDocPanel initialTab={activeDocType} />;
      case AppMode.LESSON_OBSERVATION: return <LessonObservationGenerator />;
      case AppMode.COUNSELING_LOG: return <CounselingLogGenerator />;
      case AppMode.CLASS_LOG: return <ClassManagementLogGenerator />;
      case AppMode.STUDENT_MEMO: return <StudentMemoBoard />;
      case AppMode.EDUCATION_QA: return <EducationAssistantQA />;
      case AppMode.SETTINGS: return <SettingsScreen />;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">에듀노트 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <GlobalStateContext.Provider value={{ state, setState, isGlobalGenerating, setIsGlobalGenerating, globalProgress, setGlobalProgress }}>
      <div className={darkMode ? 'dark' : ''} style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="flex h-screen bg-[#F5F7FA] dark:bg-gray-900 overflow-hidden font-sans">

        {/* School Level Modal */}
        {showSchoolLevelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
              <div className="flex items-center gap-2 mb-2">
                <School className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">학교급 선택</h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">학생기록 AI는 학교급에 따라 다른 결과를 생성합니다.</p>
              <div className="space-y-2">
                {[SchoolLevel.ELEMENTARY, SchoolLevel.MIDDLE, SchoolLevel.HIGH].map(level => (
                  <button
                    key={level}
                    onClick={() => handleSchoolLevelSelect(level)}
                    className="w-full py-3 text-sm font-bold rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:text-gray-200 transition-all"
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sidebar */}
        <aside className="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0 overflow-hidden">

          {/* Logo + dark toggle */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
            <h1 className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">에듀노트</h1>
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={darkMode ? '라이트 모드' : '다크 모드'}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">

            {/* 학생기록 AI Section */}
            <div>
              <button
                onClick={() => setStudentSectionOpen(!studentSectionOpen)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 group"
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">학생기록 AI</span>
                </div>
                <div className="flex items-center gap-1">
                  {hasEnteredStudentSection && (
                    <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-normal normal-case">
                      {schoolLevel}
                    </span>
                  )}
                  {studentSectionOpen
                    ? <ChevronDown className="w-3 h-3 text-blue-400" />
                    : <ChevronRight className="w-3 h-3 text-blue-400" />}
                </div>
              </button>

              {studentSectionOpen && (
                <div className="mt-1 space-y-0.5">
                  {studentMenuItems.map(({ mode: m, icon: Icon, label, badge }) => (
                    <button key={m} onClick={() => handleModeChange(m)} className={studentNavClass(m)}>
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-left truncate">{label}</span>
                      {badge && mode !== m && (
                        <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold">{badge}</span>
                      )}
                    </button>
                  ))}
                  {hasEnteredStudentSection && (
                    <button
                      onClick={() => setShowSchoolLevelModal(true)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                    >
                      <School className="w-3.5 h-3.5" />
                      학교급 변경
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="h-px bg-gray-100 dark:bg-gray-700 my-2" />

            {/* 교무 AI Section */}
            <div>
              <button
                onClick={() => setAdminSectionOpen(!adminSectionOpen)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                  <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">교무 AI</span>
                </div>
                {adminSectionOpen
                  ? <ChevronDown className="w-3 h-3 text-teal-400" />
                  : <ChevronRight className="w-3 h-3 text-teal-400" />}
              </button>

              {adminSectionOpen && (
                <div className="mt-1 space-y-0.5">
                  {/* 공문서 작성기 - expandable */}
                  <div>
                    <button
                      onClick={handleSchoolDocParent}
                      className={adminNavClass(AppMode.SCHOOL_DOC, true)}
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-left truncate">공문서 작성기</span>
                      {schoolDocSubOpen
                        ? <ChevronDown className="w-3 h-3 shrink-0 opacity-70" />
                        : <ChevronRight className="w-3 h-3 shrink-0 opacity-70" />}
                    </button>

                    {schoolDocSubOpen && (
                      <div className="mt-0.5 space-y-0.5 border-l-2 border-teal-200 dark:border-teal-700 ml-3">
                        {ALL_DOC_TYPES.map(dt => (
                          <button
                            key={dt}
                            onClick={() => handleSchoolDocNav(dt)}
                            className={docSubNavClass(dt)}
                          >
                            <File className="w-3 h-3 shrink-0" />
                            <span className="truncate">{DOC_TYPE_LABELS[dt]}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {adminMenuItems.map(({ mode: m, icon: Icon, label }) => (
                    <button key={m} onClick={() => setMode(m)} className={adminNavClass(m)}>
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-left truncate">{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Settings at bottom */}
          <div className="border-t border-gray-100 dark:border-gray-700 p-2 shrink-0">
            {!hasApiKey && (
              <div className="mb-2 px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md text-xs text-amber-700 dark:text-amber-400">
                API 키를 설정해 주세요
              </div>
            )}
            <button
              onClick={() => setMode(AppMode.SETTINGS)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-all cursor-pointer ${
                mode === AppMode.SETTINGS
                  ? 'bg-gray-700 dark:bg-gray-600 text-white font-semibold'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>설정</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {renderContent()}
        </main>

      </div>
      </div>
    </GlobalStateContext.Provider>
  );
};

export default App;
