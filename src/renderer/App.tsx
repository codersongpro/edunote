import React, { useState, useEffect, useRef } from 'react';
import { AppMode, SchoolLevel, DocType } from './types';
import { GlobalStateContext, initialGlobalState } from './GlobalStateContext';
import { GlobalState } from './types';

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
import LessonMaterialGenerator from './components/LessonMaterialGenerator';
import SettingsScreen from './components/SettingsScreen';
import HomeScreen from './components/HomeScreen';
import UsageGuideScreen from './components/UsageGuideScreen';
import AboutScreen from './components/AboutScreen';

import {
  Bot, BookOpen, User2, Dumbbell, Palette,
  FileText, Eye, MessageCircle, CalendarDays, StickyNote, GraduationCap,
  Settings, ChevronDown, ChevronRight, School, Sun, Moon, File,
  Home, AlertTriangle, BookMarked, Presentation, Info, X, HelpCircle,
} from 'lucide-react';

const STUDENT_RECORD_MODES: AppMode[] = [
  AppMode.RECORD_CHATBOT, AppMode.GENERATOR,
  AppMode.SUBJECT_GENERATOR, AppMode.SPORTS_CLUB_GENERATOR, AppMode.CREATIVE_ACTIVITY_GENERATOR,
];

const LESSON_AI_MODES: AppMode[] = [AppMode.LESSON_MATERIAL];

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

  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>(SchoolLevel.HIGH);
  const [showSchoolLevelModal, setShowSchoolLevelModal] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [hasEnteredStudentSection, setHasEnteredStudentSection] = useState(false);
  const [studentSectionOpen, setStudentSectionOpen] = useState(false);
  const [adminSectionOpen, setAdminSectionOpen] = useState(false);
  const [schoolDocSubOpen, setSchoolDocSubOpen] = useState(false);
  const [activeDocType, setActiveDocType] = useState<DocType>(DocType.GONGMUN);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showConcurrentNotice, setShowConcurrentNotice] = useState(false);
  const [lessonSectionOpen, setLessonSectionOpen] = useState(false);
  const concurrentNoticeDismissed = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [generatingModes, setGeneratingModes] = useState<Map<string, number>>(new Map());
  const setGeneratingMode = (modeKey: string, progress: number | null) => {
    setGeneratingModes(prev => {
      const next = new Map(prev);
      if (progress === null) next.delete(modeKey);
      else next.set(modeKey, progress);
      return next;
    });
  };
  const [mountedModes, setMountedModes] = useState<Set<AppMode>>(new Set([AppMode.HOME]));
  const goTo = (newMode: AppMode) => {
    setMode(newMode);
    setMountedModes(prev => new Set([...prev, newMode]));
    setGeneratingModes(prev => {
      if (prev.size > 0 && !concurrentNoticeDismissed.current) setShowConcurrentNotice(true);
      return prev;
    });
  };

  const handleDismissConcurrentNotice = () => {
    localStorage.setItem('edunote_concurrent_v1', 'seen');
    concurrentNoticeDismissed.current = true;
    setShowConcurrentNotice(false);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [hn, sl, dm] = await Promise.all([
          window.electronAPI.hasApiKey(),
          window.electronAPI.getConfig('schoolLevel'),
          window.electronAPI.getConfig('darkMode'),
        ]);
        setHasApiKey(hn as boolean);
        if (sl) { setSchoolLevel(sl as SchoolLevel); setHasEnteredStudentSection(true); }
        setDarkMode(!!(dm as boolean));
        const disclaimerAccepted = localStorage.getItem('edunote_disclaimer_v2');
        if (!disclaimerAccepted) setShowDisclaimerModal(true);
        if (localStorage.getItem('edunote_concurrent_v1')) concurrentNoticeDismissed.current = true;
        setMode(AppMode.HOME);
      } catch {
        setMode(AppMode.HOME);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const handleAcceptDisclaimer = () => {
    localStorage.setItem('edunote_disclaimer_v2', 'accepted');
    setShowDisclaimerModal(false);
  };

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
    goTo(newMode);
  };

  const handleSchoolLevelSelect = (level: SchoolLevel) => {
    setSchoolLevel(level);
    setHasEnteredStudentSection(true);
    setShowSchoolLevelModal(false);
    window.electronAPI.setConfig({ schoolLevel: level });
    const pendingMode = (state as any)._pendingMode;
    if (pendingMode) {
      goTo(pendingMode);
      setState(prev => { const s = { ...prev }; delete (s as any)._pendingMode; return s; });
    } else {
      goTo(AppMode.RECORD_CHATBOT);
    }
  };

  const handleSchoolDocNav = (docType: DocType) => {
    goTo(AppMode.SCHOOL_DOC);
    setActiveDocType(docType);
    setSchoolDocSubOpen(true);
  };

  const handleSchoolDocParent = () => {
    if (!schoolDocSubOpen) {
      setSchoolDocSubOpen(true);
      goTo(AppMode.SCHOOL_DOC);
    } else {
      setSchoolDocSubOpen(false);
    }
  };

  const handleHomeNavigate = (target: 'settings' | 'student' | 'admin' | 'guide') => {
    if (target === 'settings') goTo(AppMode.SETTINGS);
    else if (target === 'guide') goTo(AppMode.USAGE_GUIDE);
    else if (target === 'student') handleModeChange(AppMode.RECORD_CHATBOT);
    else if (target === 'admin') { goTo(AppMode.EDUCATION_QA); setAdminSectionOpen(true); }
  };

  const studentNavClass = (m: AppMode) =>
    `w-full flex items-center gap-2.5 px-3 py-2 text-base rounded-md transition-all cursor-pointer ${
      mode === m
        ? 'bg-blue-600 text-white font-semibold shadow-sm'
        : 'text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300'
    }`;

  const adminNavClass = (m: AppMode, isDocParent = false) =>
    `w-full flex items-center gap-2.5 px-3 py-2 text-base rounded-md transition-all cursor-pointer ${
      (isDocParent && mode === AppMode.SCHOOL_DOC) || (!isDocParent && mode === m)
        ? 'bg-teal-600 text-white font-semibold shadow-sm'
        : 'text-gray-600 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-300'
    }`;

  const docSubNavClass = (dt: DocType) =>
    `w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-sm rounded-md transition-all cursor-pointer ${
      mode === AppMode.SCHOOL_DOC && activeDocType === dt
        ? 'bg-teal-500 text-white font-semibold'
        : 'text-gray-500 dark:text-gray-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-300'
    }`;

  const studentMenuItems = [
    { mode: AppMode.RECORD_CHATBOT, icon: Bot, label: '학생기록AI 챗봇' },
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
  ];

  const ADMIN_MODES: AppMode[] = [
    AppMode.EDUCATION_QA, AppMode.SCHOOL_DOC, AppMode.LESSON_OBSERVATION,
    AppMode.COUNSELING_LOG, AppMode.CLASS_LOG, AppMode.STUDENT_MEMO,
  ];

  const contentAccent =
    STUDENT_RECORD_MODES.includes(mode)
      ? 'from-blue-400 via-blue-500 to-indigo-500'
      : ADMIN_MODES.includes(mode)
      ? 'from-teal-400 via-teal-500 to-emerald-500'
      : LESSON_AI_MODES.includes(mode)
      ? 'from-amber-400 via-amber-500 to-orange-500'
      : 'from-transparent to-transparent';

  const renderMode = (m: AppMode): React.ReactNode => {
    switch (m) {
      case AppMode.HOME: return <HomeScreen onNavigate={handleHomeNavigate} darkMode={darkMode} />;
      case AppMode.USAGE_GUIDE: return <UsageGuideScreen />;
      case AppMode.RECORD_CHATBOT: return <RecordChatbot schoolLevel={schoolLevel} />;
      case AppMode.GENERATOR: return <OpinionGenerator schoolLevel={schoolLevel} />;
      case AppMode.SUBJECT_GENERATOR: return <SubjectGenerator schoolLevel={schoolLevel} />;
      case AppMode.SPORTS_CLUB_GENERATOR: return <SportsClubGenerator schoolLevel={schoolLevel} />;
      case AppMode.CREATIVE_ACTIVITY_GENERATOR: return <CreativeActivityGenerator schoolLevel={schoolLevel} />;
      case AppMode.EDUCATION_QA: return <EducationAssistantQA />;
      case AppMode.SCHOOL_DOC: return <SchoolDocPanel initialTab={activeDocType} />;
      case AppMode.LESSON_OBSERVATION: return <LessonObservationGenerator />;
      case AppMode.COUNSELING_LOG: return <CounselingLogGenerator />;
      case AppMode.CLASS_LOG: return <ClassManagementLogGenerator />;
      case AppMode.STUDENT_MEMO: return <StudentMemoBoard />;
      case AppMode.LESSON_MATERIAL: return <LessonMaterialGenerator />;
      case AppMode.SETTINGS: return <SettingsScreen />;
      case AppMode.ABOUT: return <AboutScreen />;
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
    <GlobalStateContext.Provider value={{ state, setState, isGlobalGenerating, setIsGlobalGenerating, globalProgress, setGlobalProgress, generatingModes, setGeneratingMode }}>
      <div className={darkMode ? 'dark' : ''} style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="flex h-screen bg-[#F5F7FA] dark:bg-gray-900 overflow-hidden font-sans">

        {/* Disclaimer Modal */}
        {showDisclaimerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4">
              {/* Icon */}
              <div className="flex flex-col items-center mb-5">
                <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-3">
                  <AlertTriangle className="w-8 h-8 text-orange-500" />
                </div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white">AI 활용 시 유의사항</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">사용 전 반드시 확인해주세요</p>
              </div>

              {/* Numbered items */}
              <div className="space-y-4 mb-6">
                {[
                  { n: '01', title: '정보 정확성 확인', desc: 'AI 생성 내용은 사실과 다를 수 있습니다. 반드시 담당자 검토 후 사용하세요.' },
                  { n: '02', title: '개인정보 보호', desc: '학생·학부모·교직원의 이름, 연락처 등 민감정보를 절대 입력하지 마세요.' },
                  { n: '03', title: '법적 책임', desc: '최종 문서에 대한 모든 책임은 사용자 본인에게 있습니다.' },
                ].map(({ n, title, desc }) => (
                  <div key={n} className="flex gap-3">
                    <span className="text-xs font-black text-gray-400 dark:text-gray-500 w-5 shrink-0 mt-0.5">{n}</span>
                    <div>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-100 dark:bg-gray-700 mb-4" />

              {/* Checkbox */}
              <label className="flex items-center gap-2.5 cursor-pointer mb-5 select-none">
                <input
                  type="checkbox"
                  checked={disclaimerChecked}
                  onChange={e => setDisclaimerChecked(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">위 내용을 모두 확인하고 동의합니다.</span>
              </label>

              {/* Button */}
              <button
                onClick={handleAcceptDisclaimer}
                disabled={!disclaimerChecked}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-1"
              >
                에듀노트 시작하기 →
              </button>
            </div>
          </div>
        )}

        {/* Concurrent generation notice */}
        {showConcurrentNotice && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4">
            <div className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-xl shadow-lg p-4 flex gap-3 items-start">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg shrink-0">
                <Info className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-0.5">동시 생성 안내</p>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  다른 메뉴에서 생성 중에도 이 화면을 계속 사용할 수 있습니다.
                  무료 API는 <strong>분당 15회 요청 제한</strong>이 있어 <strong>3~4개 동시 생성</strong>이 현실적인 안전선입니다.
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={handleDismissConcurrentNotice}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
                >확인</button>
                <button
                  onClick={() => setShowConcurrentNotice(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition-colors"
                ><X className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        )}

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
        <aside className="w-64 bg-[#FAFBFC] dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0 overflow-hidden">

          <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
            <button
              onClick={() => setMode(AppMode.HOME)}
              className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              에듀노트
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={darkMode ? '라이트 모드' : '다크 모드'}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">

            <button
              onClick={() => setMode(AppMode.HOME)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-base rounded-md transition-all cursor-pointer ${
                mode === AppMode.HOME
                  ? 'bg-gray-800 dark:bg-gray-600 text-white font-semibold'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Home className="w-4 h-4 shrink-0" />
              <span>홈</span>
            </button>

            <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />

            {/* ── 교무행정AI ── */}
            <div className="rounded-xl overflow-hidden border border-teal-100 dark:border-teal-900/50 bg-teal-50/40 dark:bg-teal-950/20">
              <button
                onClick={() => setAdminSectionOpen(!adminSectionOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-teal-50/80 dark:hover:bg-teal-900/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-teal-500 flex items-center justify-center shrink-0">
                    <FileText className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-bold text-teal-700 dark:text-teal-300 tracking-wide">교무행정AI</span>
                </div>
                {adminSectionOpen ? <ChevronDown className="w-3 h-3 text-teal-400" /> : <ChevronRight className="w-3 h-3 text-teal-400" />}
              </button>
              {adminSectionOpen && (
                <div className="px-1.5 pb-1.5 space-y-0.5">
                  <button onClick={() => goTo(AppMode.EDUCATION_QA)} className={adminNavClass(AppMode.EDUCATION_QA)}>
                    <GraduationCap className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left truncate">교육AI챗봇</span>
                    {generatingModes.has(AppMode.EDUCATION_QA) && mode !== AppMode.EDUCATION_QA && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-teal-200 dark:bg-teal-800 text-teal-700 dark:text-teal-200 rounded font-bold shrink-0 tabular-nums">
                        {generatingModes.get(AppMode.EDUCATION_QA)}%
                      </span>
                    )}
                  </button>
                  <div>
                    <button onClick={handleSchoolDocParent} className={adminNavClass(AppMode.SCHOOL_DOC, true)}>
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-left truncate">공문서 작성기</span>
                      {generatingModes.has(AppMode.SCHOOL_DOC) && mode !== AppMode.SCHOOL_DOC && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-teal-200 dark:bg-teal-800 text-teal-700 dark:text-teal-200 rounded font-bold shrink-0 tabular-nums">
                          {generatingModes.get(AppMode.SCHOOL_DOC)}%
                        </span>
                      )}
                      {schoolDocSubOpen ? <ChevronDown className="w-3 h-3 shrink-0 opacity-70" /> : <ChevronRight className="w-3 h-3 shrink-0 opacity-70" />}
                    </button>
                    {schoolDocSubOpen && (
                      <div className="mt-0.5 space-y-0.5 border-l-2 border-teal-200 dark:border-teal-700 ml-3">
                        {ALL_DOC_TYPES.map(dt => (
                          <button key={dt} onClick={() => handleSchoolDocNav(dt)} className={docSubNavClass(dt)}>
                            <File className="w-3 h-3 shrink-0" />
                            <span className="flex-1 truncate">{DOC_TYPE_LABELS[dt]}</span>
                            {generatingModes.has(`SCHOOL_DOC_${dt}`) && (
                              <span className="text-[9px] px-1 py-0.5 bg-teal-200 dark:bg-teal-800 text-teal-700 dark:text-teal-200 rounded font-bold shrink-0 tabular-nums">
                                {generatingModes.get(`SCHOOL_DOC_${dt}`)}%
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {adminMenuItems.map(({ mode: m, icon: Icon, label }) => (
                    <button key={m} onClick={() => goTo(m)} className={adminNavClass(m)}>
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-left truncate">{label}</span>
                      {generatingModes.has(m) && mode !== m && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-teal-200 dark:bg-teal-800 text-teal-700 dark:text-teal-200 rounded font-bold shrink-0 tabular-nums">
                          {generatingModes.get(m)}%
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="h-1.5" />

            {/* ── 수업자료AI ── */}
            <div className="rounded-xl overflow-hidden border border-amber-100 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20">
              <button
                onClick={() => setLessonSectionOpen(!lessonSectionOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-amber-50/80 dark:hover:bg-amber-900/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-amber-500 flex items-center justify-center shrink-0">
                    <Presentation className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-300 tracking-wide">수업자료AI</span>
                </div>
                {lessonSectionOpen ? <ChevronDown className="w-3 h-3 text-amber-400" /> : <ChevronRight className="w-3 h-3 text-amber-400" />}
              </button>
              {lessonSectionOpen && (
                <div className="px-1.5 pb-1.5 space-y-0.5">
                  <button
                    onClick={() => goTo(AppMode.LESSON_MATERIAL)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-base rounded-md transition-all cursor-pointer ${
                      mode === AppMode.LESSON_MATERIAL
                        ? 'bg-amber-500 text-white font-semibold shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-300'
                    }`}
                  >
                    <Presentation className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left truncate">수업자료 생성</span>
                    {generatingModes.has(AppMode.LESSON_MATERIAL) && mode !== AppMode.LESSON_MATERIAL && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-200 rounded font-bold shrink-0 tabular-nums">
                        {generatingModes.get(AppMode.LESSON_MATERIAL)}%
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="h-1.5" />

            {/* ── 학생기록AI ── */}
            <div className="rounded-xl overflow-hidden border border-blue-100 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20">
              <button
                onClick={() => setStudentSectionOpen(!studentSectionOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-blue-50/80 dark:hover:bg-blue-900/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center shrink-0">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-bold text-blue-700 dark:text-blue-300 tracking-wide">학생기록AI</span>
                </div>
                <div className="flex items-center gap-1">
                  {hasEnteredStudentSection && (
                    <span className="text-[9px] bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium">{schoolLevel}</span>
                  )}
                  {studentSectionOpen ? <ChevronDown className="w-3 h-3 text-blue-400" /> : <ChevronRight className="w-3 h-3 text-blue-400" />}
                </div>
              </button>
              {studentSectionOpen && (
                <div className="px-1.5 pb-1.5 space-y-0.5">
                  {studentMenuItems.map(({ mode: m, icon: Icon, label }) => (
                    <button key={m} onClick={() => handleModeChange(m)} className={studentNavClass(m)}>
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-left truncate">{label}</span>
                      {generatingModes.has(m) && mode !== m && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded font-bold shrink-0 tabular-nums">
                          {generatingModes.get(m)}%
                        </span>
                      )}
                    </button>
                  ))}
                  {hasEnteredStudentSection && (
                    <button
                      onClick={() => setShowSchoolLevelModal(true)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-blue-500 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                    >
                      <School className="w-3.5 h-3.5" />
                      학교급 변경
                    </button>
                  )}
                </div>
              )}
            </div>
          </nav>

          <div className="border-t border-gray-100 dark:border-gray-700 p-2 shrink-0 space-y-0.5">
            {!hasApiKey && (
              <div className="mb-1.5 px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md text-xs text-amber-700 dark:text-amber-400">
                API 키를 설정해 주세요
              </div>
            )}
            <button
              onClick={() => goTo(AppMode.USAGE_GUIDE)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-base rounded-md transition-all cursor-pointer ${
                mode === AppMode.USAGE_GUIDE
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300'
              }`}
            >
              <BookMarked className="w-4 h-4 shrink-0" />
              <span>사용 방법</span>
            </button>
            <button
              onClick={() => goTo(AppMode.ABOUT)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-base rounded-md transition-all cursor-pointer ${
                mode === AppMode.ABOUT
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300'
              }`}
            >
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>도움말 / 정보</span>
            </button>
            <button
              onClick={() => goTo(AppMode.SETTINGS)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-base rounded-md transition-all cursor-pointer ${
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

        <main className="flex-1 overflow-hidden flex flex-col">
          <div className={`h-[3px] shrink-0 bg-gradient-to-r transition-all duration-500 ${contentAccent}`} />
          {/* Generation progress bar */}
          {generatingModes.has(mode) && (() => {
            const pct = generatingModes.get(mode) ?? -1;
            return pct === -1
              ? <div className="h-[2px] shrink-0 bg-blue-400 animate-pulse" />
              : (
                <div className="h-[2px] shrink-0 bg-gray-100 dark:bg-gray-700 overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-500 ease-out bg-gradient-to-r ${
                      STUDENT_RECORD_MODES.includes(mode)
                        ? 'from-blue-400 to-blue-600'
                        : ADMIN_MODES.includes(mode)
                        ? 'from-teal-400 to-teal-600'
                        : LESSON_AI_MODES.includes(mode)
                        ? 'from-amber-400 to-amber-600'
                        : 'from-gray-400 to-gray-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              );
          })()}
          {/* Lazy-mounted views */}
          {(Array.from(mountedModes) as AppMode[]).map(m => (
            <div key={m} className={m === mode ? 'flex-1 overflow-hidden flex flex-col' : 'hidden'}>
              {renderMode(m)}
            </div>
          ))}
        </main>

      </div>
      </div>
    </GlobalStateContext.Provider>
  );
};

export default App;
