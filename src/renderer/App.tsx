import React, { useState, useEffect, useRef } from 'react';
import { AppMode, SchoolLevel, DocType, ToastMessage } from './types';
import { GlobalStateContext, initialGlobalState } from './GlobalStateContext';
import { GlobalState } from './types';

import RecordChatbot from './components/RecordChatbot';
import OpinionGenerator from './components/OpinionGenerator';
import SubjectGenerator from './components/SubjectGenerator';
import SportsClubGenerator from './components/SportsClubGenerator';
import CreativeActivityGenerator from './components/CreativeActivityGenerator';
import SchoolDocPanel from './components/SchoolDocPanel';
import TeacherRecordPanel from './components/TeacherRecordPanel';
import ClassToolsPanel from './components/ClassToolsPanel';
import DemoSamplesScreen from './components/DemoSamplesScreen';
import StudentMemoBoard from './components/StudentMemoBoard';
import EducationAssistantQA from './components/EducationAssistantQA';
import OfficialDocAnalyzer from './components/OfficialDocAnalyzer';
import LessonMaterialGenerator from './components/LessonMaterialGenerator';
import MyResourceLibrary from './components/MyResourceLibrary';
import SettingsScreen from './components/SettingsScreen';
import HomeScreen from './components/HomeScreen';
import UsageGuideScreen from './components/UsageGuideScreen';
import AboutScreen from './components/AboutScreen';
import { initAudioUnlock } from './lib/soundEffect';

import {
  Bot, BookOpen, User2, Dumbbell, Palette,
  FileText, Eye, StickyNote, GraduationCap, MessageCircle, CalendarDays,
  Settings, ChevronDown, ChevronRight, School, Sun, Moon, File,
  Home, AlertTriangle, BookMarked, Presentation, Info, X, HelpCircle, QrCode, CheckCircle,
  GripVertical, ClipboardList, Wrench, Download, Wallet, Archive, Printer,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import MyToolsScreen from './components/MyToolsScreen';
import BudgetPlannerScreen from './components/BudgetPlannerScreen';
import DocArchivePanel from './components/DocArchivePanel';
import PrintFormScreen from './components/PrintFormScreen';

const SCHOOL_LEVEL_REQUIRED_MODES: AppMode[] = [
  AppMode.RECORD_CHATBOT, AppMode.GENERATOR,
  AppMode.SUBJECT_GENERATOR, AppMode.SPORTS_CLUB_GENERATOR, AppMode.CREATIVE_ACTIVITY_GENERATOR,
];

const STUDENT_RECORD_MODES: AppMode[] = [
  ...SCHOOL_LEVEL_REQUIRED_MODES,
  AppMode.TEACHER_RECORD, AppMode.STUDENT_MEMO, AppMode.STUDENT_RECORD_GROUP,
];

const LESSON_AI_MODES: AppMode[] = [AppMode.LESSON_MATERIAL, AppMode.CLASS_TOOLS, AppMode.MY_RESOURCES];
const MY_TOOLS_MODES: AppMode[] = [AppMode.MY_AI_TOOLS, AppMode.MY_AI_TOOLS_SHARED];

const DOC_TYPE_LABELS: Record<DocType, string> = {
  [DocType.GONGMUN]: '공문서',
  [DocType.PLAN]: '계획서',
  [DocType.REPORT]: '보고서',
  [DocType.PUMUI]: '품의서',
  [DocType.MEETING_MINUTES]: '회의록',
  [DocType.PROMOTION]: '홍보자료',
  [DocType.NEWSLETTER]: '가정통신문',
  [DocType.MESSAGE]: '메세지',
  [DocType.GONGGO]: '공고문',
};

const ALL_DOC_TYPES = [
  DocType.GONGMUN, DocType.PLAN, DocType.REPORT, DocType.PUMUI,
  DocType.MEETING_MINUTES, DocType.PROMOTION, DocType.NEWSLETTER,
  DocType.MESSAGE, DocType.GONGGO,
];

type SidebarMenuItem = {
  mode: AppMode;
  icon?: React.ElementType;
  label: string;
};

const orderStorageKey = (section: string) => `edunote_menu_order_${section}_v1`;

const restoreMenuOrder = (section: string, items: SidebarMenuItem[]) => {
  try {
    const stored = JSON.parse(localStorage.getItem(orderStorageKey(section)) || '[]') as AppMode[];
    if (!Array.isArray(stored) || stored.length === 0) return items;
    const byMode = new Map(items.map(item => [item.mode, item]));
    const ordered = stored.map(mode => byMode.get(mode)).filter(Boolean) as SidebarMenuItem[];
    const missing = items.filter(item => !stored.includes(item.mode));
    return [...ordered, ...missing];
  } catch {
    return items;
  }
};

const isDemoWindow = window.location.hash === '#demo';

const App: React.FC = () => {
  const [state, setState] = useState<GlobalState>(initialGlobalState);
  const [isGlobalGenerating, setIsGlobalGenerating] = useState(false);
  const [globalProgress, setGlobalProgress] = useState(0);

  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>(SchoolLevel.HIGH);
  const [showSchoolLevelModal, setShowSchoolLevelModal] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [showApiKeyLimitModal, setShowApiKeyLimitModal] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [hasEnteredStudentSection, setHasEnteredStudentSection] = useState(false);
  const [studentSectionOpen, setStudentSectionOpen] = useState(false);
  const [adminSectionOpen, setAdminSectionOpen] = useState(false);
  const [schoolDocSubOpen, setSchoolDocSubOpen] = useState(false);
  const [classToolsSubOpen, setClassToolsSubOpen] = useState(false);
  const [classToolsInitialTab, setClassToolsInitialTab] = useState<'qr' | 'lucky'>('qr');
  const [studentRecordGroupOpen, setStudentRecordGroupOpen] = useState(false);
  const [teacherRecordSubOpen, setTeacherRecordSubOpen] = useState(false);
  const [teacherRecordInitialTab, setTeacherRecordInitialTab] = useState<'observation' | 'counseling' | 'class'>('observation');
  const [activeDocType, setActiveDocType] = useState<DocType>(DocType.GONGMUN);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showConcurrentNotice, setShowConcurrentNotice] = useState(false);
  const [lessonSectionOpen, setLessonSectionOpen] = useState(false);
  const [myToolsSectionOpen, setMyToolsSectionOpen] = useState(false);
  const [myToolsActiveTab, setMyToolsActiveTab] = useState<'my' | 'market'>('my');
  const concurrentNoticeDismissed = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [appVersion, setAppVersion] = useState('');
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

  // API 키 실제 사용 가능 여부 (단순 저장 여부와 구분)
  const [apiKeyAvailability, setApiKeyAvailability] = useState<'unknown' | 'usable' | 'wait'>('unknown');
  const showActivationModal = () => {
    showToast({
      type: 'success',
      title: 'API 사용 가능!',
      description: 'Gemini API로 결과물을 생성할 수 있습니다.',
    });
  };

  // 생성 중단 플래그 관리 — modeKey별로 cancel 요청 여부 추적
  const cancelFlagsRef = useRef<Set<string>>(new Set());
  // AbortController — AI 호출 즉시 중단용
  const abortControllerRef = useRef<AbortController>(new AbortController());
  const requestCancel = (modeKey: string) => {
    cancelFlagsRef.current.add(modeKey);
    abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    // 즉시 진행바 숨김 — useRef 변경은 리렌더를 유발하지 않으므로 state도 함께 업데이트
    setIsGlobalGenerating(false);
    setGlobalProgress(0);
  };
  const isCancelled = (modeKey: string): boolean => cancelFlagsRef.current.has(modeKey);
  const resetGenerationState = () => {
    cancelFlagsRef.current.clear();
    abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setIsGlobalGenerating(false);
    setGlobalProgress(0);
    setGeneratingModes(new Map());
    window.dispatchEvent(new CustomEvent('edunote-generation-reset'));
  };
  const clearCancel = (modeKey: string) => { cancelFlagsRef.current.delete(modeKey); };
  const getCancelSignal = () => abortControllerRef.current.signal;

  // 토스트 알림 큐
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts(prev => [...prev, { ...toast, id }]);
    // 5초 후 자동 제거
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };
  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const goTo = (newMode: AppMode) => {
    setMode(newMode);
    setMountedModes(prev => new Set([...prev, newMode]));
    setGeneratingModes(prev => {
      if (prev.size > 0 && !concurrentNoticeDismissed.current) setShowConcurrentNotice(true);
      return prev;
    });
  };

  const handleDismissConcurrentNotice = () => {
    concurrentNoticeDismissed.current = true;
    setShowConcurrentNotice(false);
  };

  useEffect(() => {
    // 첫 사용자 상호작용에서 오디오 컨텍스트 unlock (생성 완료 효과음 보장)
    initAudioUnlock();
    const init = async () => {
      try {
        const [hn, sl, dm, lastUsable, version] = await Promise.all([
          window.electronAPI.hasApiKey(),
          window.electronAPI.getConfig('schoolLevel'),
          window.electronAPI.getConfig('darkMode'),
          window.electronAPI.getConfig('apiKeyLastUsable'),
          window.electronAPI.getVersion(),
        ]);
        setHasApiKey(hn as boolean);
        setShowApiKeyLimitModal(!(hn as boolean));
        setAppVersion(version as string);
        if (hn) setApiKeyAvailability(lastUsable ? 'usable' : 'unknown');
        if (sl) { setSchoolLevel(sl as SchoolLevel); setHasEnteredStudentSection(true); }
        setDarkMode(dm == null ? true : !!(dm as boolean));
        setShowDisclaimerModal(true);
        setMode(AppMode.HOME);
      } catch {
        setMode(AppMode.HOME);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const handleTemporaryApiError = () => {
      setApiKeyAvailability('wait');
      window.electronAPI.setConfig({ apiKeyLastUsable: false });
    };
    window.addEventListener('edunote-api-temporary-error', handleTemporaryApiError);
    return () => window.removeEventListener('edunote-api-temporary-error', handleTemporaryApiError);
  }, []);

  useEffect(() => {
    const handler = () => {
      setMode(AppMode.SETTINGS);
      setMountedModes(prev => new Set([...prev, AppMode.SETTINGS]));
    };
    window.addEventListener('edunote-goto-settings', handler);
    return () => window.removeEventListener('edunote-goto-settings', handler);
  }, []);

  const handleAcceptDisclaimer = () => {
    setShowDisclaimerModal(false);
  };

  const handleGoToApiSettings = () => {
    setShowApiKeyLimitModal(false);
    goTo(AppMode.SETTINGS);
  };

  const handleOpenApiGuide = () => {
    window.electronAPI.openExternal('https://aistudio.google.com');
  };

  const toggleDarkMode = async () => {
    const next = !darkMode;
    setDarkMode(next);
    await window.electronAPI.setConfig({ darkMode: next });
  };

  const handleModeChange = (newMode: AppMode) => {
    if (SCHOOL_LEVEL_REQUIRED_MODES.includes(newMode) && !hasEnteredStudentSection) {
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

  const handleClassToolsNav = (tab: 'qr' | 'lucky') => {
    setClassToolsInitialTab(tab);
    setClassToolsSubOpen(true);
    goTo(AppMode.CLASS_TOOLS);
  };

  const handleClassToolsParent = () => {
    if (!classToolsSubOpen) {
      setClassToolsSubOpen(true);
      goTo(AppMode.CLASS_TOOLS);
    } else {
      setClassToolsSubOpen(false);
    }
  };

  const handleTeacherRecordParent = () => {
    if (!teacherRecordSubOpen) {
      setTeacherRecordSubOpen(true);
      goTo(AppMode.TEACHER_RECORD);
    } else {
      setTeacherRecordSubOpen(false);
    }
  };

  const handleTeacherRecordNav = (tab: 'observation' | 'counseling' | 'class') => {
    setTeacherRecordInitialTab(tab);
    setTeacherRecordSubOpen(true);
    goTo(AppMode.TEACHER_RECORD);
  };

  const handleHomeNavigate = (target: 'settings' | 'student' | 'admin' | 'guide') => {
    if (target === 'settings') goTo(AppMode.SETTINGS);
    else if (target === 'guide') goTo(AppMode.USAGE_GUIDE);
    else if (target === 'student') handleModeChange(AppMode.RECORD_CHATBOT);
    else if (target === 'admin') { goTo(AppMode.EDUCATION_QA); setAdminSectionOpen(true); }
  };

  const studentNavClass = (m: AppMode) =>
    `w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md transition-all cursor-pointer ${
      mode === m
        ? 'bg-indigo-600 text-white font-semibold shadow-sm'
        : 'text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300'
    }`;

  const studentSubNavClass = (m: AppMode) =>
    `w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-sm rounded-md transition-all cursor-pointer ${
      mode === m
        ? 'bg-indigo-500 text-white font-semibold'
        : 'text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300'
    }`;

  const teacherRecordSubNavClass = (tab: 'observation' | 'counseling' | 'class') =>
    `w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-sm rounded-md transition-all cursor-pointer ${
      mode === AppMode.TEACHER_RECORD && teacherRecordInitialTab === tab
        ? 'bg-indigo-500 text-white font-semibold'
        : 'text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300'
    }`;

  const adminNavClass = (m: AppMode, isDocParent = false) =>
    `w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-all cursor-pointer ${
      (isDocParent && mode === AppMode.SCHOOL_DOC) || (!isDocParent && mode === m)
        ? 'bg-emerald-600 text-white font-semibold shadow-sm'
        : 'text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-300'
    }`;

  const docSubNavClass = (dt: DocType) =>
    `w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-sm rounded-md transition-all cursor-pointer ${
      mode === AppMode.SCHOOL_DOC && activeDocType === dt
        ? 'bg-emerald-500 text-white font-semibold'
        : 'text-gray-500 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-300'
    }`;

  const lessonNavClass = (m: AppMode, isParent = false) =>
    `w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md transition-all cursor-pointer ${
      (isParent && mode === AppMode.CLASS_TOOLS) || (!isParent && mode === m)
        ? 'bg-amber-500 text-white font-semibold shadow-sm'
        : 'text-gray-600 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-300'
    }`;

  const classToolsSubNavClass = (tab: 'qr' | 'lucky') =>
    `w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-sm rounded-md transition-all cursor-pointer ${
      mode === AppMode.CLASS_TOOLS && classToolsInitialTab === tab
        ? 'bg-amber-500 text-white font-semibold'
        : 'text-gray-500 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-300'
    }`;

  const defaultStudentMenuItems: SidebarMenuItem[] = [
    { mode: AppMode.RECORD_CHATBOT, icon: Bot, label: '학생기록AI 챗봇' },
    { mode: AppMode.STUDENT_RECORD_GROUP, icon: GraduationCap, label: '생기부도우미' },
    { mode: AppMode.TEACHER_RECORD, icon: Eye, label: '우리반기록' },
  ];

  const defaultLessonMenuItems: SidebarMenuItem[] = [
    { mode: AppMode.LESSON_MATERIAL, icon: Presentation, label: '수업자료 생성' },
    { mode: AppMode.CLASS_TOOLS, icon: QrCode, label: '수업 도구' },
    { mode: AppMode.MY_RESOURCES, icon: BookMarked, label: '나만의 자료실' },
  ];

  const defaultAdminMenuItems: SidebarMenuItem[] = [
    { mode: AppMode.EDUCATION_QA, icon: GraduationCap, label: '교무행정AI 챗봇' },
    { mode: AppMode.OFFICIAL_DOC_ANALYZER, icon: ClipboardList, label: '공문요약·업무추출' },
    { mode: AppMode.SCHOOL_DOC, icon: FileText, label: '공문서 작성기' },
    { mode: AppMode.DOC_ARCHIVE, icon: Archive, label: '공문 보관함' },
    { mode: AppMode.PRINT_FORM, icon: Printer, label: '양식 인쇄' },
    { mode: AppMode.BUDGET_PLANNER, icon: Wallet, label: '예산안작성' },
  ];

  const [studentMenuItems, setStudentMenuItems] = useState<SidebarMenuItem[]>(() => restoreMenuOrder('student', defaultStudentMenuItems));
  const [lessonMenuItems, setLessonMenuItems] = useState<SidebarMenuItem[]>(() => restoreMenuOrder('lesson', defaultLessonMenuItems));
  const [adminMenuItems, setAdminMenuItems] = useState<SidebarMenuItem[]>(() => restoreMenuOrder('admin', defaultAdminMenuItems));
  const [draggedMenu, setDraggedMenu] = useState<{ section: 'student' | 'lesson' | 'admin'; mode: AppMode } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const reorderMenuItem = (
    section: 'student' | 'lesson' | 'admin',
    fromMode: AppMode,
    toMode: AppMode,
  ) => {
    const update = (items: SidebarMenuItem[]) => {
      const fromIndex = items.findIndex(item => item.mode === fromMode);
      const toIndex = items.findIndex(item => item.mode === toMode);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return items;
      const next = [...items];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      localStorage.setItem(orderStorageKey(section), JSON.stringify(next.map(item => item.mode)));
      return next;
    };
    if (section === 'student') setStudentMenuItems(update);
    else if (section === 'lesson') setLessonMenuItems(update);
    else setAdminMenuItems(update);
  };

  const handleMenuDrop = (section: 'student' | 'lesson' | 'admin', targetMode: AppMode) => {
    if (!draggedMenu || draggedMenu.section !== section) return;
    reorderMenuItem(section, draggedMenu.mode, targetMode);
    setDraggedMenu(null);
  };

  const ADMIN_MODES: AppMode[] = [AppMode.EDUCATION_QA, AppMode.OFFICIAL_DOC_ANALYZER, AppMode.SCHOOL_DOC, AppMode.BUDGET_PLANNER, AppMode.DOC_ARCHIVE, AppMode.PRINT_FORM];

  const contentAccent =
    STUDENT_RECORD_MODES.includes(mode)
      ? 'from-indigo-400 via-indigo-500 to-sky-500'
      : ADMIN_MODES.includes(mode)
      ? 'from-emerald-400 via-emerald-500 to-emerald-500'
      : LESSON_AI_MODES.includes(mode)
      ? 'from-amber-400 via-amber-500 to-orange-500'
      : MY_TOOLS_MODES.includes(mode)
      ? 'from-pink-400 via-pink-500 to-rose-500'
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
      case AppMode.OFFICIAL_DOC_ANALYZER: return <OfficialDocAnalyzer />;
      case AppMode.SCHOOL_DOC: return <SchoolDocPanel initialTab={activeDocType} />;
      case AppMode.BUDGET_PLANNER: return <BudgetPlannerScreen />;
      case AppMode.DOC_ARCHIVE: return <DocArchivePanel />;
      case AppMode.PRINT_FORM: return <PrintFormScreen />;
      case AppMode.TEACHER_RECORD: return <TeacherRecordPanel initialTab={teacherRecordInitialTab} />;
      case AppMode.STUDENT_MEMO: return <StudentMemoBoard />;
      case AppMode.STUDENT_RECORD_GROUP: return null;
      case AppMode.LESSON_MATERIAL: return <LessonMaterialGenerator />;
      case AppMode.CLASS_TOOLS: return <ClassToolsPanel initialTab={classToolsInitialTab} />;
      case AppMode.MY_RESOURCES: return <MyResourceLibrary />;
      case AppMode.MY_AI_TOOLS: return <MyToolsScreen activeTab={myToolsActiveTab} onTabChange={setMyToolsActiveTab} schoolLevel={schoolLevel} />;
      case AppMode.MY_AI_TOOLS_SHARED: return null;
      case AppMode.SETTINGS: return <SettingsScreen />;
      case AppMode.ABOUT: return <AboutScreen />;
      case AppMode.DEMO_SAMPLES: return <DemoSamplesScreen />;
      default: return null;
    }
  };

  if (isDemoWindow) {
    return (
      <div className={darkMode ? 'dark' : ''} style={{ height: '100vh' }}>
        <div className="h-screen bg-white dark:bg-gray-900 overflow-hidden">
          <DemoSamplesScreen />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">EduNote 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <GlobalStateContext.Provider value={{ state, setState, isGlobalGenerating, setIsGlobalGenerating, globalProgress, setGlobalProgress, generatingModes, setGeneratingMode, requestCancel, isCancelled, clearCancel, getCancelSignal, apiKeyAvailability, setApiKeyAvailability, showActivationModal, showToast, resetGenerationState }}>
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
                  { n: '01', title: '정보 정확성 확인', desc: 'AI 생성 내용은 사실과 다를 수 있습니다. 사용자 스스로 전문적인 검토가 필요합니다.' },
                  { n: '02', title: '개인정보 보호', desc: '학생·학부모·교직원의 이름, 연락처 등 민감정보 입력 시 주의하여 사용하세요.' },
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
                EduNote 시작하기 →
              </button>
            </div>
          </div>
        )}

        {showApiKeyLimitModal && !showDisclaimerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">API 키가 설정되지 않았습니다</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                    EduNote는 계속 사용할 수 있지만, 학생기록 작성, 공문 작성, 예산안 AI 생성처럼 Gemini를 사용하는 기능은 제한됩니다.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 mb-4">
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-2">무료 API 키 발급 방법</p>
                <ol className="space-y-1.5 text-xs text-amber-800 dark:text-amber-100 leading-relaxed">
                  <li>1. Google AI Studio에 접속합니다.</li>
                  <li>2. Google 계정으로 로그인합니다.</li>
                  <li>3. 왼쪽 메뉴에서 API 키 또는 Get API key를 선택합니다.</li>
                  <li>4. API 키 만들기를 누른 뒤 생성된 키를 EduNote 설정에 붙여넣습니다.</li>
                </ol>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleGoToApiSettings}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors"
                >
                  설정에서 API 키 입력
                </button>
                <button
                  onClick={handleOpenApiGuide}
                  className="flex-1 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-100 font-bold rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  발급 페이지 열기
                </button>
                <button
                  onClick={() => setShowApiKeyLimitModal(false)}
                  className="py-2.5 px-4 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white text-sm font-semibold"
                >
                  나중에
                </button>
              </div>
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

        {/* 사이드바가 접혀 있을 때: 펼치기 버튼만 있는 얇은 바 */}
        {sidebarCollapsed && (
          <div className="w-11 shrink-0 bg-[#FAFBFC] dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-3 gap-2">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="메뉴 펼치기"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMode(AppMode.HOME)}
              className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="홈"
            >
              <Home className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Sidebar */}
        <aside className={`${sidebarCollapsed ? 'hidden' : 'flex'} min-w-[240px] w-[19%] max-w-[280px] bg-[#FAFBFC] dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col shrink-0 overflow-hidden`}>

          <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
            <button
              onClick={() => setMode(AppMode.HOME)}
              className="flex items-baseline gap-1.5 text-lg font-extrabold text-gray-900 dark:text-white tracking-tight hover:text-blue-600 dark:hover:text-indigo-400 transition-colors"
            >
              <span>EduNote</span>
              {appVersion && <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">v{appVersion}</span>}
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleDarkMode}
                className="p-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-amber-500 dark:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={darkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-slate-500" />}
              </button>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="p-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="메뉴 접기"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          <nav className="flex-1 min-h-0 overflow-y-auto py-3 px-2 space-y-1">

            <button
              onClick={() => setMode(AppMode.HOME)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-base rounded-md transition-all cursor-pointer ${
                mode === AppMode.HOME
                  ? 'bg-gray-800 dark:bg-gray-600 text-white font-semibold'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Home className="w-4 h-4 shrink-0" />
              <span className="truncate">홈</span>
            </button>

            <button
              onClick={() => goTo(AppMode.SETTINGS)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-all cursor-pointer ${
                mode === AppMode.SETTINGS
                  ? 'bg-gray-800 dark:bg-gray-600 text-white font-semibold'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span className="truncate">설정</span>
            </button>

            <button
              onClick={() => setShowSchoolLevelModal(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700/40 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/70 transition-all shadow-sm"
            >
              <School className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left text-sm font-bold truncate">학교급 변경</span>
              <span className="text-[10px] bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-500 px-1.5 py-0.5 rounded-full font-semibold">{schoolLevel}</span>
            </button>

            <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />

            {/* ── 교무행정AI ── */}
            <div className="rounded-xl overflow-hidden border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20">
              <button
                onClick={() => setAdminSectionOpen(!adminSectionOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-emerald-50/80 dark:hover:bg-emerald-900/20 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-emerald-500 flex items-center justify-center shrink-0">
                    <FileText className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tracking-wide truncate">교무행정AI</span>
                </div>
                {adminSectionOpen ? <ChevronDown className="w-3 h-3 text-emerald-400" /> : <ChevronRight className="w-3 h-3 text-emerald-400" />}
              </button>
              {adminSectionOpen && (
                <div className="px-1.5 pb-1.5 space-y-0.5">
                  {adminMenuItems.map(({ mode: m, icon: Icon, label }) => (
                    <div
                      key={m}
                      draggable
                      onDragStart={() => setDraggedMenu({ section: 'admin', mode: m })}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleMenuDrop('admin', m)}
                      onDragEnd={() => setDraggedMenu(null)}
                      className={`flex items-start gap-1 rounded-md ${draggedMenu?.section === 'admin' && draggedMenu.mode === m ? 'opacity-50' : ''}`}
                    >
                      <GripVertical className="w-3.5 h-3.5 shrink-0 text-emerald-400 cursor-grab mt-2.5" />
                      {m === AppMode.SCHOOL_DOC ? (
                        <div className="min-w-0 flex-1">
                          <button onClick={handleSchoolDocParent} className={adminNavClass(AppMode.SCHOOL_DOC, true)}>
                            {Icon && <Icon className="w-4 h-4 shrink-0" />}
                            <span className="flex-1 text-left truncate">{label}</span>
                            {generatingModes.has(AppMode.SCHOOL_DOC) && mode !== AppMode.SCHOOL_DOC && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-200 rounded font-bold shrink-0 tabular-nums">
                                {generatingModes.get(AppMode.SCHOOL_DOC)}%
                              </span>
                            )}
                            {schoolDocSubOpen ? <ChevronDown className="w-3 h-3 shrink-0 opacity-70" /> : <ChevronRight className="w-3 h-3 shrink-0 opacity-70" />}
                          </button>
                          {schoolDocSubOpen && (
                            <div className="mt-0.5 space-y-0.5 border-l-2 border-emerald-200 dark:border-emerald-700 ml-3">
                              {ALL_DOC_TYPES.map(dt => (
                                <button key={dt} onClick={() => handleSchoolDocNav(dt)} className={docSubNavClass(dt)}>
                                  <File className="w-3 h-3 shrink-0" />
                                  <span className="flex-1 truncate">{DOC_TYPE_LABELS[dt]}</span>
                                  {generatingModes.has(`SCHOOL_DOC_${dt}`) && (
                                    <span className="text-[9px] px-1 py-0.5 bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-200 rounded font-bold shrink-0 tabular-nums">
                                      {generatingModes.get(`SCHOOL_DOC_${dt}`)}%
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button onClick={() => goTo(m)} title={label} className={`min-w-0 flex-1 ${adminNavClass(m)}`}>
                          {Icon && <Icon className="w-4 h-4 shrink-0" />}
                          <span className="flex-1 text-left truncate">{label}</span>
                          {generatingModes.has(m) && mode !== m && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-200 rounded font-bold shrink-0 tabular-nums">
                              {generatingModes.get(m)}%
                            </span>
                          )}
                        </button>
                      )}
                    </div>
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
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-amber-500 flex items-center justify-center shrink-0">
                    <Presentation className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-300 tracking-wide truncate">수업자료AI</span>
                </div>
                {lessonSectionOpen ? <ChevronDown className="w-3 h-3 text-amber-400" /> : <ChevronRight className="w-3 h-3 text-amber-400" />}
              </button>
              {lessonSectionOpen && (
                <div className="px-1.5 pb-1.5 space-y-0.5">
                  {lessonMenuItems.map(({ mode: m, icon: Icon, label }) => (
                    <div
                      key={m}
                      draggable
                      onDragStart={() => setDraggedMenu({ section: 'lesson', mode: m })}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleMenuDrop('lesson', m)}
                      onDragEnd={() => setDraggedMenu(null)}
                      className={`flex items-start gap-1 rounded-md ${draggedMenu?.section === 'lesson' && draggedMenu.mode === m ? 'opacity-50' : ''}`}
                    >
                      <GripVertical className="w-3.5 h-3.5 shrink-0 text-amber-400 cursor-grab mt-2.5" />
                      {m === AppMode.CLASS_TOOLS ? (
                        <div className="min-w-0 flex-1">
                          <button onClick={handleClassToolsParent} className={lessonNavClass(AppMode.CLASS_TOOLS, true)}>
                            {Icon ? <Icon className="w-4 h-4 shrink-0" /> : <span className="w-4 h-4 shrink-0 flex items-center justify-center text-sm">🎲</span>}
                            <span className="flex-1 text-left truncate">{label}</span>
                            {classToolsSubOpen ? <ChevronDown className="w-3 h-3 shrink-0 opacity-70" /> : <ChevronRight className="w-3 h-3 shrink-0 opacity-70" />}
                          </button>
                          {classToolsSubOpen && (
                            <div className="mt-0.5 space-y-0.5 border-l-2 border-amber-200 dark:border-amber-700 ml-3">
                              <button onClick={() => handleClassToolsNav('qr')} className={classToolsSubNavClass('qr')}>
                                <QrCode className="w-3 h-3 shrink-0" />
                                <span className="flex-1 truncate">QR 메이커</span>
                              </button>
                              <button onClick={() => handleClassToolsNav('lucky')} className={classToolsSubNavClass('lucky')}>
                                <span className="w-3 h-3 shrink-0 flex items-center justify-center text-xs">🎲</span>
                                <span className="flex-1 truncate">럭키드로우</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => goTo(m)}
                          title={label}
                          className={`min-w-0 flex-1 ${lessonNavClass(m)}`}
                        >
                          {Icon ? <Icon className="w-4 h-4 shrink-0" /> : <span className="w-4 h-4 shrink-0 flex items-center justify-center text-sm">🎲</span>}
                          <span className="flex-1 text-left truncate">{label}</span>
                          {generatingModes.has(m) && mode !== m && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-200 rounded font-bold shrink-0 tabular-nums">
                              {generatingModes.get(m)}%
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="h-1.5" />

            {/* ── 학생기록AI ── */}
            <div className="rounded-xl overflow-hidden border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20">
              <button
                onClick={() => setStudentSectionOpen(!studentSectionOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-indigo-50/80 dark:hover:bg-indigo-900/20 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-indigo-500 flex items-center justify-center shrink-0">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300 tracking-wide truncate">학생기록AI</span>
                </div>
                <div className="flex items-center gap-1">
                  {hasEnteredStudentSection && (
                    <span className="text-[9px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded-full font-medium">{schoolLevel}</span>
                  )}
                  {studentSectionOpen ? <ChevronDown className="w-3 h-3 text-indigo-400" /> : <ChevronRight className="w-3 h-3 text-indigo-400" />}
                </div>
              </button>
              {studentSectionOpen && (
                <div className="px-1.5 pb-1.5 space-y-0.5">
                  {studentMenuItems.map(({ mode: m, icon: Icon, label }) => (
                    <div
                      key={m}
                      draggable
                      onDragStart={() => setDraggedMenu({ section: 'student', mode: m })}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleMenuDrop('student', m)}
                      onDragEnd={() => setDraggedMenu(null)}
                      className={`flex items-start gap-1 rounded-md ${draggedMenu?.section === 'student' && draggedMenu.mode === m ? 'opacity-50' : ''}`}
                    >
                      <GripVertical className="w-3.5 h-3.5 shrink-0 text-indigo-400 cursor-grab mt-2.5" />
                      {m === AppMode.STUDENT_RECORD_GROUP ? (
                        <div className="min-w-0 flex-1">
                          <button
                            onClick={() => setStudentRecordGroupOpen(prev => !prev)}
                            className={studentNavClass(AppMode.STUDENT_RECORD_GROUP)}
                          >
                            {Icon && <Icon className="w-4 h-4 shrink-0" />}
                            <span className="flex-1 text-left truncate">{label}</span>
                            {studentRecordGroupOpen ? <ChevronDown className="w-3 h-3 shrink-0 opacity-70" /> : <ChevronRight className="w-3 h-3 shrink-0 opacity-70" />}
                          </button>
                          {studentRecordGroupOpen && (
                            <div className="mt-0.5 space-y-0.5 border-l-2 border-indigo-200 dark:border-indigo-700 ml-3">
                              <button onClick={() => handleModeChange(AppMode.GENERATOR)} className={studentSubNavClass(AppMode.GENERATOR)}>
                                <User2 className="w-3 h-3 shrink-0" />
                                <span className="flex-1 truncate">행발생성</span>
                              </button>
                              <button onClick={() => handleModeChange(AppMode.SUBJECT_GENERATOR)} className={studentSubNavClass(AppMode.SUBJECT_GENERATOR)}>
                                <BookOpen className="w-3 h-3 shrink-0" />
                                <span className="flex-1 truncate">교과 세특 생성</span>
                              </button>
                              <button onClick={() => handleModeChange(AppMode.SPORTS_CLUB_GENERATOR)} className={studentSubNavClass(AppMode.SPORTS_CLUB_GENERATOR)}>
                                <Dumbbell className="w-3 h-3 shrink-0" />
                                <span className="flex-1 truncate">학교스포츠클럽</span>
                              </button>
                              <button onClick={() => handleModeChange(AppMode.CREATIVE_ACTIVITY_GENERATOR)} className={studentSubNavClass(AppMode.CREATIVE_ACTIVITY_GENERATOR)}>
                                <Palette className="w-3 h-3 shrink-0" />
                                <span className="flex-1 truncate">창체 특기사항</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : m === AppMode.TEACHER_RECORD ? (
                        <div className="min-w-0 flex-1">
                          <button onClick={handleTeacherRecordParent} className={studentNavClass(AppMode.TEACHER_RECORD)}>
                            {Icon && <Icon className="w-4 h-4 shrink-0" />}
                            <span className="flex-1 text-left truncate">{label}</span>
                            {teacherRecordSubOpen ? <ChevronDown className="w-3 h-3 shrink-0 opacity-70" /> : <ChevronRight className="w-3 h-3 shrink-0 opacity-70" />}
                          </button>
                          {teacherRecordSubOpen && (
                            <div className="mt-0.5 space-y-0.5 border-l-2 border-indigo-200 dark:border-indigo-700 ml-3">
                              <button onClick={() => handleTeacherRecordNav('observation')} className={teacherRecordSubNavClass('observation')}>
                                <Eye className="w-3 h-3 shrink-0" />
                                <span className="flex-1 truncate">수업관찰기록</span>
                              </button>
                              <button onClick={() => handleTeacherRecordNav('counseling')} className={teacherRecordSubNavClass('counseling')}>
                                <MessageCircle className="w-3 h-3 shrink-0" />
                                <span className="flex-1 truncate">상담일지</span>
                              </button>
                              <button onClick={() => handleTeacherRecordNav('class')} className={teacherRecordSubNavClass('class')}>
                                <CalendarDays className="w-3 h-3 shrink-0" />
                                <span className="flex-1 truncate">학급경영일지</span>
                              </button>
                              <button onClick={() => goTo(AppMode.STUDENT_MEMO)} className={studentSubNavClass(AppMode.STUDENT_MEMO)}>
                                <StickyNote className="w-3 h-3 shrink-0" />
                                <span className="flex-1 truncate">학생 메모 보드</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button onClick={() => handleModeChange(m)} title={label} className={`min-w-0 flex-1 ${studentNavClass(m)}`}>
                          {Icon && <Icon className="w-4 h-4 shrink-0" />}
                          <span className="flex-1 text-left truncate">{label}</span>
                          {generatingModes.has(m) && mode !== m && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200 rounded font-bold shrink-0 tabular-nums">
                              {generatingModes.get(m)}%
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="h-1.5" />

            {/* ── 나만의AI ── */}
            <div className="rounded-xl overflow-hidden border border-pink-100 dark:border-pink-900/50 bg-pink-50/40 dark:bg-pink-950/20">
              <button
                onClick={() => setMyToolsSectionOpen(!myToolsSectionOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-pink-50/80 dark:hover:bg-pink-900/20 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-pink-500 flex items-center justify-center shrink-0">
                    <Wrench className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-bold text-pink-700 dark:text-pink-300 tracking-wide truncate">AI 스킬즈</span>
                </div>
                {myToolsSectionOpen ? <ChevronDown className="w-3 h-3 text-pink-400" /> : <ChevronRight className="w-3 h-3 text-pink-400" />}
              </button>
              {myToolsSectionOpen && (
                <div className="px-1.5 pb-1.5 space-y-0.5">
                  <button
                    onClick={() => { setMyToolsActiveTab('my'); goTo(AppMode.MY_AI_TOOLS); }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md transition-all cursor-pointer ${
                      mode === AppMode.MY_AI_TOOLS && myToolsActiveTab === 'my'
                        ? 'bg-pink-500 text-white font-semibold shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-pink-50 dark:hover:bg-pink-900/30 hover:text-pink-700 dark:hover:text-pink-300'
                    }`}
                  >
                    <Wrench className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left truncate">내 스킬</span>
                  </button>
                  <button
                    onClick={() => { setMyToolsActiveTab('market'); goTo(AppMode.MY_AI_TOOLS); }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md transition-all cursor-pointer ${
                      mode === AppMode.MY_AI_TOOLS && myToolsActiveTab === 'market'
                        ? 'bg-pink-500 text-white font-semibold shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-pink-50 dark:hover:bg-pink-900/30 hover:text-pink-700 dark:hover:text-pink-300'
                    }`}
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left truncate">스킬마켓</span>
                  </button>
                </div>
              )}
            </div>
          </nav>

          <div className="border-t border-gray-100 dark:border-gray-700 p-2 shrink-0 space-y-0.5">
            {apiKeyAvailability === 'usable' ? (
              <button
                onClick={() => goTo(AppMode.SETTINGS)}
                className="w-full mb-1.5 px-2 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-md text-xs text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors text-left flex items-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">API 사용 가능!</span>
              </button>
            ) : apiKeyAvailability === 'wait' ? (
              <button
                onClick={() => goTo(AppMode.SETTINGS)}
                title="API 키는 저장되어 있지만 현재 요청 제한, 토큰 소모, 잦은 요청, 모델 일시 제한 등으로 결과물을 생성하지 못한 상태입니다. 다른 키를 넣거나 잠시 기다린 뒤 다시 시도해 주세요."
                className="w-full mb-1.5 px-2 py-1.5 bg-amber-100 dark:bg-amber-900/30 border border-amber-400 dark:border-amber-500 rounded-md text-xs text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors text-left flex items-center gap-1.5 animate-pulse ring-2 ring-amber-300/70 dark:ring-amber-500/40 shadow-sm"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>API 일시 제한 · 키 변경/잠시 후 재시도</span>
              </button>
            ) : hasApiKey ? (
              <button
                onClick={() => goTo(AppMode.SETTINGS)}
                className="w-full mb-1.5 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-left"
              >
                API 키 저장됨 · 사용 확인 필요
              </button>
            ) : (
              <button
                onClick={() => goTo(AppMode.SETTINGS)}
                className="w-full mb-1.5 px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors text-left"
              >
                ⚠ API 키를 설정해 주세요
              </button>
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
              <span className="truncate">사용 방법</span>
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
              <span className="truncate">도움말 / 정보</span>
            </button>
            <button
              onClick={() => window.electronAPI.openDemoWindow()}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-base rounded-md transition-all cursor-pointer text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span className="truncate">Demo</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden flex flex-col">
          <div className={`h-[3px] shrink-0 bg-gradient-to-r transition-all duration-500 ${contentAccent}`} />
          {/* Generation progress banner */}
          {generatingModes.has(mode) && (() => {
            const pct = generatingModes.get(mode) ?? -1;
            const colorBar = STUDENT_RECORD_MODES.includes(mode)
              ? 'from-indigo-400 to-indigo-600'
              : ADMIN_MODES.includes(mode)
              ? 'from-emerald-400 to-emerald-600'
              : LESSON_AI_MODES.includes(mode)
              ? 'from-amber-400 to-amber-600'
              : 'from-gray-400 to-gray-500';
            const colorBg = STUDENT_RECORD_MODES.includes(mode)
              ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300'
              : ADMIN_MODES.includes(mode)
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
              : LESSON_AI_MODES.includes(mode)
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900 text-amber-700 dark:text-amber-300'
              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 text-gray-600';
            const cancelled = isCancelled(mode);
            return (
              <div className={`shrink-0 flex items-center gap-3 px-4 py-1.5 border-b ${colorBg}`}>
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r ${colorBar} ${pct === -1 ? 'w-full animate-pulse' : ''}`}
                    style={pct !== -1 ? { width: `${pct}%` } : undefined}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums shrink-0">
                  {cancelled ? '중단 중...' : pct === -1 ? 'AI 생성 중...' : `AI 생성 중 ${pct}%`}
                </span>
                {/* 중단 버튼 — 클릭 시 다음 항목 처리를 막음 (진행 중인 단일 호출은 끝까지 진행) */}
                <button
                  onClick={() => requestCancel(mode)}
                  disabled={cancelled}
                  className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border border-current/40 hover:bg-white/40 dark:hover:bg-black/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="다음 항목 처리를 중단합니다 (진행 중인 항목은 마무리됨)"
                >
                  <X className="w-3 h-3" />
                  <span>중단</span>
                </button>
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

      {/* 토스트 알림 — 우상단에 슬라이드인 형태로 표시 */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
          {toasts.map(t => {
            const tone =
              t.type === 'success' ? 'bg-green-50 border-green-300 text-green-800 dark:bg-green-900/40 dark:text-green-200' :
              t.type === 'error'   ? 'bg-red-50 border-red-300 text-red-800 dark:bg-red-900/40 dark:text-red-200' :
              t.type === 'warning' ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' :
                                     'bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
            const Icon =
              t.type === 'success' ? CheckCircle :
              t.type === 'error'   ? AlertTriangle :
              t.type === 'warning' ? AlertTriangle :
                                     Info;
            return (
              <div
                key={t.id}
                className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 border rounded-lg shadow-lg ${tone}`}
                style={{ animation: 'slideInRight 0.3s ease-out' }}
              >
                <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold leading-tight">{t.title}</p>
                  {t.description && <p className="text-xs mt-1 opacity-90 leading-relaxed">{t.description}</p>}
                </div>
                <button onClick={() => dismissToast(t.id)} className="shrink-0 p-0.5 hover:opacity-70" aria-label="닫기">
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); opacity: 0; }
              to   { transform: translateX(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </GlobalStateContext.Provider>
  );
};

export default App;
