import React, { useState, useEffect } from 'react';
import { AppMode, SchoolLevel } from './types';
import { GlobalStateContext, initialGlobalState } from './GlobalStateContext';
import { GlobalState } from './types';

// Components
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
  Settings, ChevronDown, ChevronRight, School
} from 'lucide-react';

const STUDENT_RECORD_MODES: AppMode[] = [
  AppMode.RECORD_CHATBOT,
  AppMode.GUIDELINE_QA,
  AppMode.GENERATOR,
  AppMode.SUBJECT_GENERATOR,
  AppMode.SPORTS_CLUB_GENERATOR,
  AppMode.CREATIVE_ACTIVITY_GENERATOR,
];

const APP_TITLE = '에듀노트';

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
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const [hn, sl] = await Promise.all([
          window.electronAPI.hasApiKey(),
          window.electronAPI.getConfig('schoolLevel'),
        ]);
        setHasApiKey(hn as boolean);
        if (sl) setSchoolLevel(sl as SchoolLevel);
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

  const navItemClass = (m: AppMode) =>
    `w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-all cursor-pointer ${
      mode === m
        ? 'bg-[#1E88E5] text-white font-semibold'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
    { mode: AppMode.SCHOOL_DOC, icon: FileText, label: '공문서 작성기' },
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
      case AppMode.SCHOOL_DOC: return <SchoolDocPanel />;
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
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1E88E5] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">에듀노트 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <GlobalStateContext.Provider value={{ state, setState, isGlobalGenerating, setIsGlobalGenerating, globalProgress, setGlobalProgress }}>
      <div className="flex h-screen bg-[#F5F7FA] overflow-hidden font-sans">

        {/* School Level Modal */}
        {showSchoolLevelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
              <div className="flex items-center gap-2 mb-2">
                <School className="w-5 h-5 text-[#1E88E5]" />
                <h2 className="text-lg font-bold text-gray-900">학교급 선택</h2>
              </div>
              <p className="text-sm text-gray-500 mb-5">학생기록 AI는 학교급에 따라 다른 결과를 생성합니다.</p>
              <div className="space-y-2">
                {[SchoolLevel.ELEMENTARY, SchoolLevel.MIDDLE, SchoolLevel.HIGH].map(level => (
                  <button
                    key={level}
                    onClick={() => handleSchoolLevelSelect(level)}
                    className="w-full py-3 text-sm font-bold rounded-lg border-2 border-gray-200 hover:border-[#1E88E5] hover:bg-blue-50 hover:text-[#1E88E5] transition-all"
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sidebar */}
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-hidden">
          {/* Logo */}
          <div className="h-14 flex items-center px-4 border-b border-gray-100 shrink-0">
            <h1 className="text-lg font-extrabold text-gray-900 tracking-tight">{APP_TITLE}</h1>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">

            {/* 학생기록 AI Section */}
            <div>
              <button
                onClick={() => setStudentSectionOpen(!studentSectionOpen)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider hover:text-gray-700"
              >
                <span>학생기록 AI</span>
                <div className="flex items-center gap-1">
                  {hasEnteredStudentSection && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-normal normal-case">
                      {schoolLevel}
                    </span>
                  )}
                  {studentSectionOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </div>
              </button>

              {studentSectionOpen && (
                <div className="mt-1 space-y-0.5">
                  {studentMenuItems.map(({ mode: m, icon: Icon, label, badge }) => (
                    <button
                      key={m}
                      onClick={() => handleModeChange(m)}
                      className={navItemClass(m)}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-left truncate">{label}</span>
                      {badge && mode !== m && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">{badge}</span>
                      )}
                    </button>
                  ))}
                  {hasEnteredStudentSection && (
                    <button
                      onClick={() => setShowSchoolLevelModal(true)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#1E88E5] hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <School className="w-3.5 h-3.5" />
                      학교급 변경
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="h-px bg-gray-100 my-2" />

            {/* 교무 AI Section */}
            <div>
              <button
                onClick={() => setAdminSectionOpen(!adminSectionOpen)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider hover:text-gray-700"
              >
                <span>교무 AI</span>
                {adminSectionOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>

              {adminSectionOpen && (
                <div className="mt-1 space-y-0.5">
                  {adminMenuItems.map(({ mode: m, icon: Icon, label }) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={navItemClass(m)}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-left truncate">{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Settings at bottom */}
          <div className="border-t border-gray-100 p-2 shrink-0">
            {!hasApiKey && (
              <div className="mb-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700">
                API 키를 설정해 주세요
              </div>
            )}
            <button
              onClick={() => setMode(AppMode.SETTINGS)}
              className={navItemClass(AppMode.SETTINGS)}
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
    </GlobalStateContext.Provider>
  );
};

export default App;
