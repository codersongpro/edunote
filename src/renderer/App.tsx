import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppMode, SchoolLevel, DocType, ToastMessage } from './types';
import { GlobalStateContext, initialGlobalState } from './GlobalStateContext';
import { TourProvider } from './TourContext';
import { safeSetItem } from './lib/safeStorage';
import { CancellationRegistry } from './lib/cancellation';
import { GlobalState } from './types';

import RecordChatbot from './components/RecordChatbot';
import OpinionGenerator from './components/OpinionGenerator';
import SubjectGenerator from './components/SubjectGenerator';
import SportsClubGenerator from './components/SportsClubGenerator';
import CreativeActivityGenerator from './components/CreativeActivityGenerator';
import SchoolDocPanel from './components/SchoolDocPanel';
import TeacherRecordPanel from './components/TeacherRecordPanel';
import ClassToolsPanel from './components/ClassToolsPanel';
import ChatRoom from './components/ChatRoom';
import DemoSamplesScreen from './components/DemoSamplesScreen';
import StudentMemoBoard from './components/StudentMemoBoard';
import StudentCardScreen from './components/StudentCardScreen';
import EducationAssistantQA from './components/EducationAssistantQA';
import OfficialDocAnalyzer from './components/OfficialDocAnalyzer';
import LessonMaterialGenerator from './components/LessonMaterialGenerator';
import MyResourceLibrary from './components/MyResourceLibrary';
import SettingsScreen from './components/SettingsScreen';
import HomeScreen from './components/HomeScreen';
import UsageGuideScreen from './components/UsageGuideScreen';
import AboutScreen from './components/AboutScreen';
import { initAudioUnlock } from './lib/soundEffect';
import { useEscapeKey } from './hooks/useEscapeKey';
import { API_KEY_UPDATED_EVENT, GEMINI_API_CLOUD_FALLBACK_STEPS, GEMINI_API_GUIDE_STEPS, GEMINI_API_GUIDE_VIDEO_URL } from './lib/apiKeyGuide';

import {
  Bot, BookOpen, User2, Dumbbell, Palette,
  FileText, Eye, StickyNote, GraduationCap, MessageCircle, CalendarDays,
  Settings, ChevronDown, ChevronRight, School, Sun, Moon, File,
  Home, AlertTriangle, BookMarked, Presentation, Info, X, HelpCircle, QrCode, CheckCircle,
  GripVertical, ClipboardList, Wrench, Wallet, Archive, Printer,
  PanelLeftClose, PanelLeftOpen, ListTodo, Languages, ZoomIn, ZoomOut, Video, Star, IdCard,
} from 'lucide-react';
import MyToolsScreen from './components/MyToolsScreen';
import BudgetPlannerScreen from './components/BudgetPlannerScreen';
import DocArchivePanel from './components/DocArchivePanel';
import PrintFormScreen from './components/PrintFormScreen';
import DocTodoPanel, { loadDocTodos, daysUntil } from './components/DocTodoPanel';
import TranslatorScreen from './components/TranslatorScreen';
import { loadWorkDraft, saveWorkDraft, WorkDraft } from './lib/workDraft';
import RestoreDraftModal from './components/RestoreDraftModal';
import {
  getNavigationSection,
  getNavigationSectionHeaderClass,
  getNavigationSelectionClass,
  isSidebarModeActive,
} from './lib/sidebarNavigation';

const SCHOOL_LEVEL_REQUIRED_MODES: AppMode[] = [
  AppMode.RECORD_CHATBOT, AppMode.GENERATOR,
  AppMode.SUBJECT_GENERATOR, AppMode.SPORTS_CLUB_GENERATOR, AppMode.CREATIVE_ACTIVITY_GENERATOR,
];

const STUDENT_RECORD_MODES: AppMode[] = [
  ...SCHOOL_LEVEL_REQUIRED_MODES,
  AppMode.TEACHER_RECORD, AppMode.STUDENT_MEMO, AppMode.STUDENT_CARD, AppMode.STUDENT_RECORD_GROUP,
];

const LESSON_AI_MODES: AppMode[] = [AppMode.LESSON_MATERIAL, AppMode.CLASS_TOOLS, AppMode.MY_RESOURCES];
const MY_TOOLS_MODES: AppMode[] = [AppMode.MY_AI_TOOLS, AppMode.MY_AI_TOOLS_SHARED];

const DOC_TYPE_LABELS: Record<DocType, string> = {
  [DocType.GONGMUN]: '공문서',
  [DocType.PLAN]: '계획서',
  [DocType.TRAINING_MATERIAL]: '연수자료',
  [DocType.REPORT]: '보고서',
  [DocType.PUMUI]: '품의서',
  [DocType.MEETING_MINUTES]: '회의록',
  [DocType.PROMOTION]: '홍보자료',
  [DocType.NEWSLETTER]: '가정통신문',
  [DocType.MESSAGE]: '메세지',
  [DocType.GONGGO]: '공고문',
};

const ALL_DOC_TYPES = [
  DocType.GONGMUN, DocType.PLAN, DocType.TRAINING_MATERIAL, DocType.REPORT, DocType.PUMUI,
  DocType.MEETING_MINUTES, DocType.PROMOTION, DocType.NEWSLETTER,
  DocType.MESSAGE, DocType.GONGGO,
];

type SidebarMenuItem = {
  mode: AppMode;
  icon?: React.ElementType;
  label: string;
};

type MenuSection = 'student' | 'lesson' | 'admin' | 'myTools';

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
const isChatWindow = window.location.hash === '#chat';

const App: React.FC = () => {
  const [state, setState] = useState<GlobalState>(initialGlobalState);
  const [isGlobalGenerating, setIsGlobalGenerating] = useState(false);
  const [globalProgress, setGlobalProgress] = useState(0);

  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>(SchoolLevel.HIGH);
  const [showSchoolLevelModal, setShowSchoolLevelModal] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [showApiKeyLimitModal, setShowApiKeyLimitModal] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [onboardingApiKey, setOnboardingApiKey] = useState('');
  const [onboardingApiTier, setOnboardingApiTier] = useState<'free' | 'paid'>('free');
  const [onboardingApiStatus, setOnboardingApiStatus] = useState<'idle' | 'testing' | 'tested' | 'warning' | 'saved' | 'error'>('idle');
  const [onboardingApiMessage, setOnboardingApiMessage] = useState('');
  const [onboardingTeacherName, setOnboardingTeacherName] = useState('');
  const [onboardingInstitution, setOnboardingInstitution] = useState('');
  const [onboardingGradeClass, setOnboardingGradeClass] = useState('');
  const [onboardingShowCloudAlt, setOnboardingShowCloudAlt] = useState(false);
  const [hasEnteredStudentSection, setHasEnteredStudentSection] = useState(false);
  const [studentSectionOpen, setStudentSectionOpen] = useState(false);
  const [adminSectionOpen, setAdminSectionOpen] = useState(false);
  const [classToolsInitialTab, setClassToolsInitialTab] = useState<'qr' | 'lucky' | 'chat'>('qr');
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
  const [fontSize, setFontSize] = useState(100);
  const [appVersion, setAppVersion] = useState('');
  const [generatingModes, setGeneratingModes] = useState<Map<string, number>>(new Map());
  const setGeneratingMode = useCallback((modeKey: string, progress: number | null) => {
    setGeneratingModes(prev => {
      const next = new Map(prev);
      if (progress === null) next.delete(modeKey);
      else next.set(modeKey, progress);
      return next;
    });
  }, []);
  const [mountedModes, setMountedModes] = useState<Set<AppMode>>(new Set([AppMode.HOME]));

  // API 키 실제 사용 가능 여부 (단순 저장 여부와 구분)
  const [apiKeyAvailability, setApiKeyAvailability] = useState<'unknown' | 'usable' | 'wait'>('unknown');

  // 토스트 알림 큐
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts(prev => [...prev, { ...toast, id }]);
    // 5초 후 자동 제거
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const showActivationModal = useCallback(() => {
    showToast({
      type: 'success',
      title: 'API 사용 가능!',
      description: 'Gemini API로 결과물을 생성할 수 있습니다.',
    });
  }, [showToast]);

  // 생성 중단 플래그 관리 — modeKey별로 cancel 요청 여부 추적
  const cancelFlagsRef = useRef<Set<string>>(new Set());
  // 중단 신호 — 화면(modeKey)별로 분리해 한 화면의 중단이 다른 화면 생성에 영향을 주지 않는다
  const cancellationRef = useRef<CancellationRegistry>(new CancellationRegistry());
  const requestCancel = useCallback((modeKey: string) => {
    cancelFlagsRef.current.add(modeKey);
    cancellationRef.current.cancel(modeKey);
    // 즉시 진행바 숨김 — useRef 변경은 리렌더를 유발하지 않으므로 state도 함께 업데이트
    setIsGlobalGenerating(false);
    setGlobalProgress(0);
  }, []);
  const isCancelled = useCallback((modeKey: string): boolean => cancelFlagsRef.current.has(modeKey), []);
  const resetGenerationState = useCallback(() => {
    cancelFlagsRef.current.clear();
    cancellationRef.current.cancelAll();
    setIsGlobalGenerating(false);
    setGlobalProgress(0);
    setGeneratingModes(new Map());
    window.dispatchEvent(new CustomEvent('edunote-generation-reset'));
  }, []);
  const clearCancel = useCallback((modeKey: string) => { cancelFlagsRef.current.delete(modeKey); }, []);
  const getCancelSignal = useCallback((modeKey: string) => cancellationRef.current.signalFor(modeKey), []);
  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // ── 작업 자동 저장 · 이어서 하기 ─────────────────────────────────
  // 생기부 작업 상태는 그동안 메모리에만 있어 앱을 닫으면 사라졌다. 일정 간격으로
  // 파일에 저장하고, 다음 실행에서 복원할지 사용자에게 물어본다.
  const [pendingDraft, setPendingDraft] = useState<WorkDraft | null>(null);
  // 복원 여부를 정하기 전에는 자동 저장을 미룬다(빈 초기 상태가 초안을 덮어쓰는 것을 막는다).
  const draftReadyRef = useRef(false);

  useEffect(() => {
    if (isDemoWindow || isChatWindow) return;
    let cancelled = false;
    loadWorkDraft().then(draft => {
      if (cancelled) return;
      if (draft) setPendingDraft(draft);
      else draftReadyRef.current = true;
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isDemoWindow || isChatWindow) return;
    if (!draftReadyRef.current) return;
    const timer = setTimeout(() => { void saveWorkDraft(state); }, 1500);
    return () => clearTimeout(timer);
  }, [state]);

  const handleRestoreDraft = () => {
    if (pendingDraft) setState(pendingDraft.state);
    setPendingDraft(null);
    draftReadyRef.current = true;
  };

  const handleDiscardDraft = () => {
    setPendingDraft(null);
    draftReadyRef.current = true;
    void saveWorkDraft(initialGlobalState);
  };

  // 컨텍스트 value를 메모이제이션해 생성 진행(600ms 간격) 중 불필요한 전역 리렌더를 줄인다.
  const globalStateValue = useMemo(() => ({
    state, setState, isGlobalGenerating, setIsGlobalGenerating, globalProgress, setGlobalProgress,
    generatingModes, setGeneratingMode, requestCancel, isCancelled, clearCancel, getCancelSignal,
    apiKeyAvailability, setApiKeyAvailability, showActivationModal, showToast, resetGenerationState,
  }), [
    state, isGlobalGenerating, globalProgress, generatingModes, apiKeyAvailability,
    setGeneratingMode, requestCancel, isCancelled, clearCancel, getCancelSignal,
    showActivationModal, showToast, resetGenerationState,
  ]);

  const goTo = (newMode: AppMode) => {
    setMode(newMode);
    // 내 스킬·스킬마켓은 같은 MyToolsScreen 인스턴스를 공유해야 하므로 마운트 키를 하나로 합친다
    // (분리하면 인스턴스가 두 개 생겨 한쪽에서 가져오기/삭제해도 다른 쪽 상태가 갱신되지 않는 버그가 생김)
    const mountMode = newMode === AppMode.MY_AI_TOOLS_SHARED ? AppMode.MY_AI_TOOLS : newMode;
    setMountedModes(prev => new Set([...prev, mountMode]));
    setGeneratingModes(prev => {
      if (prev.size > 0 && !concurrentNoticeDismissed.current) setShowConcurrentNotice(true);
      return prev;
    });
  };

  const handleMyToolsTabChange = (tab: 'my' | 'market') => {
    setMyToolsActiveTab(tab);
    goTo(tab === 'market' ? AppMode.MY_AI_TOOLS_SHARED : AppMode.MY_AI_TOOLS);
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
        const [hn, sl, dm, lastUsable, version, apiTier, teacherName, institution, gradeClass, fz] = await Promise.all([
          window.electronAPI.hasApiKey(),
          window.electronAPI.getConfig('schoolLevel'),
          window.electronAPI.getConfig('darkMode'),
          window.electronAPI.getConfig('apiKeyLastUsable'),
          window.electronAPI.getVersion(),
          window.electronAPI.getConfig('apiTier'),
          window.electronAPI.getConfig('teacherName'),
          window.electronAPI.getConfig('institution'),
          window.electronAPI.getConfig('gradeClass'),
          window.electronAPI.getConfig('fontSize'),
        ]);
        setHasApiKey(hn as boolean);
        setShowApiKeyLimitModal(!(hn as boolean));
        setAppVersion(version as string);
        setOnboardingApiTier((apiTier as 'free' | 'paid') || 'free');
        setOnboardingTeacherName(String(teacherName || ''));
        setOnboardingInstitution(String(institution || ''));
        setOnboardingGradeClass(String(gradeClass || ''));
        if (hn) {
          setApiKeyAvailability(lastUsable ? 'usable' : 'unknown');
          setOnboardingApiStatus('saved');
        }
        if (sl) { setSchoolLevel(sl as SchoolLevel); setHasEnteredStudentSection(true); }
        setDarkMode(dm == null ? true : !!(dm as boolean));
        if (typeof fz === 'number') setFontSize(fz);
        setShowDisclaimerModal(true);
        setMode(AppMode.HOME);
      } catch {
        setMode(AppMode.HOME);
      } finally {
        setIsLoading(false);
      }
    };
    init();

    // 자동 정기 백업 — 설정한 주기(매일/매주)가 지났으면 조용히 백업한다.
    // 주기 판단과 저장은 메인 프로세스가 처리하고, 여기서는 localStorage만 전달한다.
    try {
      const dump: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key) dump[key] = localStorage.getItem(key) ?? '';
      }
      void window.electronAPI.autoBackup(dump).catch(() => {});
    } catch {
      // 자동 백업 실패가 앱 시작을 막지 않도록 한다.
    }

    // 마감이 3일 이내이거나 이미 지난 공문 할일이 있으면 알려준다.
    loadDocTodos()
      .then(todos => {
        const urgent = todos.filter(t => {
          if (t.done || !t.deadline) return false;
          const days = daysUntil(t.deadline);
          return days !== null && days <= 3;
        });
        if (urgent.length > 0) {
          showToast({
            type: 'warning',
            title: `마감이 임박한 공문 할일이 ${urgent.length}건 있습니다.`,
            description: urgent.slice(0, 3).map(t => `${t.title} (${t.deadline})`).join(' · '),
          });
        }
      })
      .catch(() => {});
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

  // 전역 토스트 이벤트(lib/toast.ts) 수신 — 컴포넌트에서 context 없이도 토스트를 띄울 수 있게 한다.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.title === 'string') {
        showToast({ type: detail.type || 'info', title: detail.title, description: detail.description });
      }
    };
    window.addEventListener('edunote-toast', handler);
    return () => window.removeEventListener('edunote-toast', handler);
  }, []);

  useEffect(() => {
    if (MY_TOOLS_MODES.includes(mode)) setMyToolsSectionOpen(true);
  }, [mode]);

  // 닫기 동작이 있는 모달은 Esc로 닫을 수 있게 한다.
  // (면책 모달은 동의 체크가 필요해 닫기 동작이 없으므로 Esc를 적용하지 않는다.)
  useEscapeKey(showApiKeyLimitModal && !showDisclaimerModal, () => setShowApiKeyLimitModal(false));
  useEscapeKey(showSchoolLevelModal, () => setShowSchoolLevelModal(false));

  const handleAcceptDisclaimer = () => {
    setShowDisclaimerModal(false);
  };

  const getProgressFor = (key: string) => {
    if (!generatingModes.has(key)) return null;
    return generatingModes.get(key) ?? -1;
  };

  const handleGoToApiSettings = () => {
    setShowApiKeyLimitModal(false);
    goTo(AppMode.SETTINGS);
  };

  const handleTestOnboardingApiKey = async () => {
    const key = onboardingApiKey.trim();
    if (!key) {
      setOnboardingApiStatus('error');
      setOnboardingApiMessage('API 키를 입력해 주세요.');
      return null;
    }
    setOnboardingApiStatus('testing');
    setOnboardingApiMessage('');
    try {
      const result = await window.electronAPI.testApiKey(key, onboardingApiTier);
      if (!result.ok) {
        setOnboardingApiStatus('error');
        setOnboardingApiMessage(result.error || '키를 다시 확인해 주세요.');
        return result;
      }
      setOnboardingApiStatus(result.warning ? 'warning' : 'tested');
      setOnboardingApiMessage(result.warning || 'API 사용 가능!');
      setApiKeyAvailability(result.wait ? 'wait' : 'usable');
      if (!result.wait) resetGenerationState();
      return result;
    } catch {
      setOnboardingApiStatus('error');
      setOnboardingApiMessage('잠시 후 다시 시도해 주세요.');
      return null;
    }
  };

  const handleSaveOnboardingApiKey = async () => {
    const key = onboardingApiKey.trim();
    if (!key) return;
    try {
      const result = await handleTestOnboardingApiKey();
      if (!result?.ok) {
        showToast({ type: 'error', title: 'API 키 확인 실패', description: result?.error || '키를 다시 확인해 주세요.' });
        return;
      }
      const { usedPlaintext } = await window.electronAPI.setApiKey(key, onboardingApiTier);
      await window.electronAPI.setConfig({ apiTier: onboardingApiTier, apiKeyLastUsable: !result.wait });
      setHasApiKey(true);
      setApiKeyAvailability(result.wait ? 'wait' : 'usable');
      setOnboardingApiKey('');
      setOnboardingApiStatus('saved');
      setOnboardingApiMessage('API 키가 저장되었습니다.');
      window.dispatchEvent(new CustomEvent(API_KEY_UPDATED_EVENT));
      showToast({ type: 'success', title: 'API 키 저장 완료', description: 'EduNote에서 AI 기능을 사용할 수 있습니다.' });
      if (usedPlaintext) {
        showToast({ type: 'warning', title: '암호화 저장소를 사용할 수 없음', description: '이 컴퓨터에서는 API 키가 암호화 없이 저장됩니다.' });
      }
    } catch {
      setOnboardingApiStatus('error');
      setOnboardingApiMessage('잠시 후 다시 시도해 주세요.');
      showToast({ type: 'error', title: 'API 키 저장 실패', description: '잠시 후 다시 시도해 주세요.' });
    }
  };

  const handleSaveOnboardingProfile = async () => {
    await window.electronAPI.setConfig({
      teacherName: onboardingTeacherName,
      institution: onboardingInstitution,
      schoolLevel,
      gradeClass: onboardingGradeClass,
    });
    setHasEnteredStudentSection(true);
    showToast({ type: 'success', title: '기본 정보 저장 완료' });
  };

  const handleFinishOnboarding = async () => {
    await window.electronAPI.setConfig({
      teacherName: onboardingTeacherName,
      institution: onboardingInstitution,
      schoolLevel,
      gradeClass: onboardingGradeClass,
    });
    setHasEnteredStudentSection(true);
    setShowApiKeyLimitModal(false);
    handleAcceptDisclaimer();
  };

  const handleStartAfterDisclaimer = () => {
    setShowApiKeyLimitModal(false);
    handleAcceptDisclaimer();
  };

  const handleOpenApiGuide = () => {
    window.electronAPI.openExternal('https://aistudio.google.com');
  };

  const handleOpenApiGuideVideo = () => {
    window.electronAPI.openExternal(GEMINI_API_GUIDE_VIDEO_URL);
  };

  const toggleDarkMode = async () => {
    const next = !darkMode;
    setDarkMode(next);
    await window.electronAPI.setConfig({ darkMode: next });
  };

  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * fontSize / 100}px`;
  }, [fontSize]);

  const changeFontSize = async (delta: number) => {
    const next = Math.min(150, Math.max(75, fontSize + delta));
    setFontSize(next);
    await window.electronAPI.setConfig({ fontSize: next });
  };

  const resetFontSize = async () => {
    setFontSize(100);
    await window.electronAPI.setConfig({ fontSize: 100 });
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
  };

  const handleSchoolDocParent = () => {
    goTo(AppMode.SCHOOL_DOC);
  };

  const handleClassToolsParent = () => {
    goTo(AppMode.CLASS_TOOLS);
  };

  const handleTeacherRecordParent = () => {
    goTo(AppMode.TEACHER_RECORD);
  };

  const handleTeacherRecordNav = (tab: 'observation' | 'counseling' | 'class') => {
    setTeacherRecordInitialTab(tab);
    goTo(AppMode.TEACHER_RECORD);
  };

  const handleHomeNavigate = (target: 'settings' | 'student' | 'admin' | 'guide') => {
    if (target === 'settings') goTo(AppMode.SETTINGS);
    else if (target === 'guide') goTo(AppMode.USAGE_GUIDE);
    else if (target === 'student') handleModeChange(AppMode.RECORD_CHATBOT);
    else if (target === 'admin') { goTo(AppMode.EDUCATION_QA); setAdminSectionOpen(true); }
  };

  // 홈 화면의 "빠른 시작" 타일에서 자주 쓰는 기능으로 바로 이동한다(학년 선택이 필요한 기능은 handleModeChange가 처리).
  const handleHomeQuickStart = (key: 'chat' | 'record' | 'lesson' | 'docAnalyze' | 'schoolDoc') => {
    if (key === 'chat') { setClassToolsInitialTab('chat'); setLessonSectionOpen(true); handleModeChange(AppMode.CLASS_TOOLS); }
    else if (key === 'record') handleModeChange(AppMode.GENERATOR);
    else if (key === 'lesson') { setLessonSectionOpen(true); handleModeChange(AppMode.LESSON_MATERIAL); }
    else if (key === 'docAnalyze') { setAdminSectionOpen(true); handleModeChange(AppMode.OFFICIAL_DOC_ANALYZER); }
    else if (key === 'schoolDoc') { setAdminSectionOpen(true); handleModeChange(AppMode.SCHOOL_DOC); }
  };

  const activeNavigationSection = getNavigationSection(mode);

  const studentNavClass = (m: AppMode) =>
    `w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md transition-all cursor-pointer ${
      isSidebarModeActive(mode, m)
        ? getNavigationSelectionClass('student', true)
        : 'text-[#78716C] dark:text-[#9C8F87] hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300'
    }`;

  const adminNavClass = (m: AppMode, isDocParent = false) =>
    `w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-all cursor-pointer ${
      (isDocParent && mode === AppMode.SCHOOL_DOC) || (!isDocParent && mode === m)
        ? getNavigationSelectionClass('admin', true)
        : 'text-[#78716C] dark:text-[#9C8F87] hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-300'
    }`;

  const lessonNavClass = (m: AppMode, isParent = false) =>
    `w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md transition-all cursor-pointer ${
      (isParent && mode === AppMode.CLASS_TOOLS) || (!isParent && mode === m)
        ? getNavigationSelectionClass('lesson', true)
        : 'text-[#78716C] dark:text-[#9C8F87] hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-300'
    }`;

  const myToolsNavClass = (m: AppMode) =>
    `w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-all cursor-pointer ${
      mode === m
        ? getNavigationSelectionClass('myTools', true)
        : 'text-[#78716C] dark:text-[#9C8F87] hover:bg-pink-50 dark:hover:bg-pink-900/30 hover:text-pink-700 dark:hover:text-pink-300'
    }`;

  const favNavClass = (m: AppMode) =>
    `w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md transition-all cursor-pointer ${
      isSidebarModeActive(mode, m)
        ? getNavigationSelectionClass('lesson', true)
        : 'text-[#78716C] dark:text-[#9C8F87] hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-300'
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
    { mode: AppMode.DOC_TODO, icon: ListTodo, label: '공문 할일' },
    { mode: AppMode.SCHOOL_DOC, icon: FileText, label: '문서작성기' },
    { mode: AppMode.DOC_ARCHIVE, icon: Archive, label: '공문 보관함' },
    { mode: AppMode.PRINT_FORM, icon: Printer, label: '양식 인쇄' },
    { mode: AppMode.BUDGET_PLANNER, icon: Wallet, label: '예산안작성' },
    { mode: AppMode.TRANSLATOR, icon: Languages, label: '간단 번역' },
  ];

  const defaultMyToolsMenuItems: SidebarMenuItem[] = [
    { mode: AppMode.MY_AI_TOOLS, icon: Wrench, label: '내 스킬' },
    { mode: AppMode.MY_AI_TOOLS_SHARED, icon: BookMarked, label: '스킬마켓' },
  ];

  const [studentMenuItems, setStudentMenuItems] = useState<SidebarMenuItem[]>(() => restoreMenuOrder('student', defaultStudentMenuItems));
  const [lessonMenuItems, setLessonMenuItems] = useState<SidebarMenuItem[]>(() => restoreMenuOrder('lesson', defaultLessonMenuItems));
  const [adminMenuItems, setAdminMenuItems] = useState<SidebarMenuItem[]>(() => restoreMenuOrder('admin', defaultAdminMenuItems));
  const [myToolsMenuItems, setMyToolsMenuItems] = useState<SidebarMenuItem[]>(() => restoreMenuOrder('myTools', defaultMyToolsMenuItems));
  const [draggedMenu, setDraggedMenu] = useState<{ section: MenuSection; mode: AppMode } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const reorderMenuItem = (
    section: MenuSection,
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
      safeSetItem(orderStorageKey(section), JSON.stringify(next.map(item => item.mode)));
      return next;
    };
    if (section === 'student') setStudentMenuItems(update);
    else if (section === 'lesson') setLessonMenuItems(update);
    else if (section === 'admin') setAdminMenuItems(update);
    else setMyToolsMenuItems(update);
  };

  const handleMenuDrop = (section: MenuSection, targetMode: AppMode) => {
    if (!draggedMenu || draggedMenu.section !== section) return;
    reorderMenuItem(section, draggedMenu.mode, targetMode);
    setDraggedMenu(null);
  };

  // 즐겨찾기(수동 고정) — 사이드바 각 메뉴의 ☆ 버튼으로 고정하면 상단 "즐겨찾기" 섹션에 모인다. 이 PC에 저장된다.
  const FAVORITES_KEY = 'edunote_menu_favorites_v1';
  const [favorites, setFavorites] = useState<AppMode[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
      return Array.isArray(stored) ? stored.filter((m): m is AppMode => Object.values(AppMode).includes(m)) : [];
    } catch {
      return [];
    }
  });
  const isFavorite = (m: AppMode) => favorites.includes(m);
  const toggleFavorite = (m: AppMode) => {
    setFavorites(prev => {
      const next = prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m];
      safeSetItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  };
  // 즐겨찾기 항목의 아이콘·라벨을 찾는 표(기본 메뉴 정의 기준).
  const menuItemByMode = new Map<AppMode, SidebarMenuItem>(
    [...defaultStudentMenuItems, ...defaultLessonMenuItems, ...defaultAdminMenuItems, ...defaultMyToolsMenuItems].map(it => [it.mode, it]),
  );
  // 즐겨찾기에서 모드별로 알맞은 이동 처리(그룹·특수 패널은 사이드바와 동일한 핸들러를 쓴다).
  const navigateMode = (m: AppMode) => {
    if (m === AppMode.STUDENT_RECORD_GROUP) handleModeChange(AppMode.GENERATOR);
    else if (m === AppMode.TEACHER_RECORD) handleTeacherRecordParent();
    else if (m === AppMode.SCHOOL_DOC) handleSchoolDocParent();
    else if (m === AppMode.CLASS_TOOLS) handleClassToolsParent();
    else if (m === AppMode.MY_AI_TOOLS || m === AppMode.MY_AI_TOOLS_SHARED) handleMyToolsTabChange(m === AppMode.MY_AI_TOOLS_SHARED ? 'market' : 'my');
    else handleModeChange(m);
  };

  const ADMIN_MODES: AppMode[] = [AppMode.EDUCATION_QA, AppMode.OFFICIAL_DOC_ANALYZER, AppMode.DOC_TODO, AppMode.SCHOOL_DOC, AppMode.BUDGET_PLANNER, AppMode.DOC_ARCHIVE, AppMode.PRINT_FORM, AppMode.TRANSLATOR];

  const topNavItems = (() => {
    if (mode === AppMode.SCHOOL_DOC) {
      return ALL_DOC_TYPES.map(dt => ({
        key: `doc-${dt}`,
        label: DOC_TYPE_LABELS[dt],
        icon: File,
        active: activeDocType === dt,
        progress: getProgressFor(`SCHOOL_DOC_${dt}`),
        onClick: () => handleSchoolDocNav(dt),
      }));
    }
    if ([AppMode.GENERATOR, AppMode.SUBJECT_GENERATOR, AppMode.SPORTS_CLUB_GENERATOR, AppMode.CREATIVE_ACTIVITY_GENERATOR].includes(mode)) {
      return [
        { key: AppMode.GENERATOR, label: '행발생성', icon: User2, active: mode === AppMode.GENERATOR, progress: getProgressFor(AppMode.GENERATOR), onClick: () => handleModeChange(AppMode.GENERATOR) },
        { key: AppMode.SUBJECT_GENERATOR, label: '교과 세특 생성', icon: BookOpen, active: mode === AppMode.SUBJECT_GENERATOR, progress: getProgressFor(AppMode.SUBJECT_GENERATOR), onClick: () => handleModeChange(AppMode.SUBJECT_GENERATOR) },
        { key: AppMode.SPORTS_CLUB_GENERATOR, label: '학교스포츠클럽', icon: Dumbbell, active: mode === AppMode.SPORTS_CLUB_GENERATOR, progress: getProgressFor(AppMode.SPORTS_CLUB_GENERATOR), onClick: () => handleModeChange(AppMode.SPORTS_CLUB_GENERATOR) },
        { key: AppMode.CREATIVE_ACTIVITY_GENERATOR, label: '창체 특기사항', icon: Palette, active: mode === AppMode.CREATIVE_ACTIVITY_GENERATOR, progress: getProgressFor(AppMode.CREATIVE_ACTIVITY_GENERATOR), onClick: () => handleModeChange(AppMode.CREATIVE_ACTIVITY_GENERATOR) },
      ];
    }
    if (mode === AppMode.TEACHER_RECORD || mode === AppMode.STUDENT_MEMO || mode === AppMode.STUDENT_CARD) {
      return [
        { key: 'observation', label: '수업관찰기록', icon: Eye, active: mode === AppMode.TEACHER_RECORD && teacherRecordInitialTab === 'observation', progress: getProgressFor(AppMode.TEACHER_RECORD), onClick: () => handleTeacherRecordNav('observation') },
        { key: 'counseling', label: '상담일지', icon: MessageCircle, active: mode === AppMode.TEACHER_RECORD && teacherRecordInitialTab === 'counseling', progress: getProgressFor(AppMode.TEACHER_RECORD), onClick: () => handleTeacherRecordNav('counseling') },
        { key: 'class', label: '학급경영일지', icon: CalendarDays, active: mode === AppMode.TEACHER_RECORD && teacherRecordInitialTab === 'class', progress: getProgressFor(AppMode.TEACHER_RECORD), onClick: () => handleTeacherRecordNav('class') },
        { key: AppMode.STUDENT_MEMO, label: '학생 메모 보드', icon: StickyNote, active: mode === AppMode.STUDENT_MEMO, progress: getProgressFor(AppMode.STUDENT_MEMO), onClick: () => goTo(AppMode.STUDENT_MEMO) },
        { key: AppMode.STUDENT_CARD, label: '학생 카드', icon: IdCard, active: mode === AppMode.STUDENT_CARD, progress: getProgressFor(AppMode.STUDENT_CARD), onClick: () => goTo(AppMode.STUDENT_CARD) },
      ];
    }
    return [];
  })();

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

  const collapsedNavItems: Array<{
    key: string;
    label: string;
    icon: React.ElementType;
    active: boolean;
    progress?: number | null;
    onClick: () => void;
  }> = [
    { key: 'home', label: '홈', icon: Home, active: mode === AppMode.HOME, onClick: () => goTo(AppMode.HOME) },
    { key: 'settings', label: '설정', icon: Settings, active: mode === AppMode.SETTINGS, onClick: () => goTo(AppMode.SETTINGS) },
    { key: 'admin', label: '교무행정AI', icon: FileText, active: ADMIN_MODES.includes(mode), onClick: () => { setAdminSectionOpen(true); goTo(AppMode.EDUCATION_QA); } },
    { key: 'doc-analyzer', label: '공문요약·업무추출', icon: ClipboardList, active: mode === AppMode.OFFICIAL_DOC_ANALYZER, progress: getProgressFor(AppMode.OFFICIAL_DOC_ANALYZER), onClick: () => goTo(AppMode.OFFICIAL_DOC_ANALYZER) },
    { key: 'school-doc', label: '문서작성기', icon: FileText, active: mode === AppMode.SCHOOL_DOC, progress: getProgressFor(AppMode.SCHOOL_DOC), onClick: handleSchoolDocParent },
    { key: 'lesson', label: '수업자료AI', icon: Presentation, active: LESSON_AI_MODES.includes(mode), onClick: () => { setLessonSectionOpen(true); goTo(AppMode.LESSON_MATERIAL); } },
    { key: 'student', label: '학생기록AI', icon: Bot, active: STUDENT_RECORD_MODES.includes(mode), onClick: () => handleModeChange(AppMode.RECORD_CHATBOT) },
    { key: 'my-tools', label: 'AI 스킬즈', icon: Wrench, active: MY_TOOLS_MODES.includes(mode), onClick: () => { setMyToolsSectionOpen(true); handleMyToolsTabChange('my'); } },
    { key: 'guide', label: '사용 방법', icon: BookMarked, active: mode === AppMode.USAGE_GUIDE, onClick: () => goTo(AppMode.USAGE_GUIDE) },
    { key: 'about', label: '도움말 / 정보', icon: HelpCircle, active: mode === AppMode.ABOUT, onClick: () => goTo(AppMode.ABOUT) },
  ];

  const renderMode = (m: AppMode): React.ReactNode => {
    switch (m) {
      case AppMode.HOME: return <HomeScreen onNavigate={handleHomeNavigate} onQuickStart={handleHomeQuickStart} darkMode={darkMode} />;
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
      case AppMode.DOC_TODO: return <DocTodoPanel />;
      case AppMode.PRINT_FORM: return <PrintFormScreen />;
      case AppMode.TRANSLATOR: return <TranslatorScreen />;
      case AppMode.TEACHER_RECORD: return <TeacherRecordPanel initialTab={teacherRecordInitialTab} />;
      case AppMode.STUDENT_MEMO: return <StudentMemoBoard />;
      case AppMode.STUDENT_CARD: return <StudentCardScreen />;
      case AppMode.STUDENT_RECORD_GROUP: return null;
      case AppMode.LESSON_MATERIAL: return <LessonMaterialGenerator />;
      case AppMode.CLASS_TOOLS: return <ClassToolsPanel initialTab={classToolsInitialTab} />;
      case AppMode.MY_RESOURCES: return <MyResourceLibrary />;
      case AppMode.MY_AI_TOOLS:
      case AppMode.MY_AI_TOOLS_SHARED:
        return <MyToolsScreen activeTab={myToolsActiveTab} onTabChange={handleMyToolsTabChange} schoolLevel={schoolLevel} />;
      case AppMode.SETTINGS: return <SettingsScreen />;
      case AppMode.ABOUT: return <AboutScreen />;
      case AppMode.DEMO_SAMPLES: return <DemoSamplesScreen />;
      default: return null;
    }
  };

  if (isDemoWindow) {
    return (
      <div className={darkMode ? 'dark' : ''} style={{ height: '100vh' }}>
        <div className="h-screen bg-white dark:bg-[#171210] overflow-hidden">
          <DemoSamplesScreen />
        </div>
      </div>
    );
  }

  if (isChatWindow) {
    return (
      <div className={darkMode ? 'dark' : ''} style={{ height: '100vh' }}>
        <div className="flex flex-col h-screen bg-[#FAF9F7] dark:bg-[#171210] overflow-hidden font-sans">
          <ChatRoom view="conversation" />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-[#171210]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[#78716C] text-sm">EduNote 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <TourProvider>
    <GlobalStateContext.Provider value={globalStateValue}>
      <div className={darkMode ? 'dark' : ''} style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="flex h-screen bg-[#FAF9F7] dark:bg-[#171210] overflow-hidden font-sans">

        {/* 이전 작업 복원 안내 — 온보딩이 떠 있는 동안에는 겹치지 않게 뒤로 미룬다 */}
        {pendingDraft && !showDisclaimerModal && (
          <RestoreDraftModal
            savedAt={pendingDraft.savedAt}
            onRestore={handleRestoreDraft}
            onDiscard={handleDiscardDraft}
          />
        )}

        {/* Onboarding Modal */}
        {showDisclaimerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100/85 dark:bg-black/70 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="onboarding-modal-title">
            <div className="bg-white dark:bg-[#221E1B] rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden max-h-[90vh] flex flex-col">
              <div className="bg-gradient-to-r from-indigo-600 to-violet-500 text-white px-8 py-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 id="onboarding-modal-title" className="text-lg font-black">EduNote 시작하기</h2>
                  <span className="text-xs font-bold text-white/75">단계 {onboardingStep} / 3</span>
                </div>
                <div className="flex items-start">
                  {[
                    { n: 1, label: '사용동의' },
                    { n: 2, label: 'API 키 입력' },
                    { n: 3, label: '사용자설정 입력' },
                  ].map((step, index, steps) => (
                    <React.Fragment key={step.n}>
                      <div className="flex flex-col items-center gap-2 min-w-[96px]">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                          onboardingStep > step.n ? 'bg-emerald-100 text-emerald-600' :
                          onboardingStep === step.n ? 'bg-white text-indigo-600' :
                          'bg-white/20 text-white/70'
                        }`}>
                          {onboardingStep > step.n ? <CheckCircle className="w-4 h-4" /> : step.n}
                        </div>
                        <span className={`text-xs font-bold text-center ${onboardingStep === step.n ? 'text-white' : 'text-white/65'}`}>{step.label}</span>
                      </div>
                      {index < steps.length - 1 && <div className="h-px flex-1 bg-white/30 mt-4" />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div className="px-8 py-7 overflow-y-auto flex-1">
                {onboardingStep === 1 && (
                  <div>
                    <h3 className="text-lg font-black text-[#1C1917] dark:text-[#F0EBE6] mb-1">AI 활용 시 유의사항</h3>
                    <p className="text-sm text-[#78716C] dark:text-[#9C8F87] mb-7">사용 전 반드시 확인해주세요</p>
                    <div className="space-y-5">
                      {[
                        { n: '01', title: '정보 정확성 확인', desc: 'AI 생성 내용은 사실과 다를 수 있습니다. 사용자 스스로 전문적인 검토가 필요합니다.' },
                        { n: '02', title: '개인정보 보호', desc: '학생·학부모·교직원의 이름, 연락처 등 민감정보 입력 시 주의하여 사용하세요.' },
                        { n: '03', title: '법적 책임', desc: '최종 문서에 대한 모든 책임은 사용자 본인에게 있습니다.' },
                      ].map(({ n, title, desc }) => (
                        <div key={n} className="flex gap-4">
                          <span className="text-xs font-black text-slate-300 dark:text-[#6B5E57] w-6 shrink-0 mt-0.5">{n}</span>
                          <div>
                            <p className="text-sm font-bold text-[#1C1917] dark:text-[#F0EBE6]">{title}</p>
                            <p className="text-sm text-[#78716C] dark:text-[#9C8F87] leading-relaxed mt-1">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="h-px bg-[#EDE8E1] dark:bg-[#2E2822] my-7" />
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={disclaimerChecked}
                        onChange={e => setDisclaimerChecked(e.target.checked)}
                        className="w-4 h-4 rounded border-[#E7E5E4] accent-indigo-600 cursor-pointer"
                      />
                      <span className="text-sm font-semibold text-[#44403C] dark:text-[#C4B8B0]">위 내용을 모두 확인하고 동의합니다.</span>
                    </label>
                  </div>
                )}
                {onboardingStep === 2 && (
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.9fr] gap-7">
                    <div>
                      <h3 className="text-lg font-black text-[#1C1917] dark:text-[#F0EBE6] mb-1">API 키 설정</h3>
                      <p className="text-sm text-[#78716C] dark:text-[#9C8F87] mb-6">Gemini API 키를 입력하면 AI 기능을 모두 사용할 수 있습니다.</p>
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <button
                          onClick={() => { setOnboardingApiTier('free'); setOnboardingApiStatus('idle'); setOnboardingApiMessage(''); }}
                          className={`text-left rounded-lg border-2 px-4 py-3 ${
                            onboardingApiTier === 'free'
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                              : 'border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#171210]'
                          }`}
                        >
                          <p className="text-sm font-black text-indigo-700 dark:text-indigo-300">무료 Gmail 기본</p>
                          <p className="text-xs text-indigo-400 mt-1">분당 15회 무료</p>
                        </button>
                        <button
                          onClick={() => { setOnboardingApiTier('paid'); setOnboardingApiStatus('idle'); setOnboardingApiMessage(''); }}
                          className={`text-left rounded-lg border-2 px-4 py-3 ${
                            onboardingApiTier === 'paid'
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                              : 'border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#171210]'
                          }`}
                        >
                          <p className="text-sm font-bold text-[#78716C] dark:text-[#9C8F87]">유료 API</p>
                          <p className="text-xs text-[#A8A29E] dark:text-[#6B5E57] mt-1">사용량 기반 과금</p>
                        </button>
                      </div>
                      <p className="mb-3 text-[11px] leading-relaxed text-[#A8A29E] dark:text-[#6B5E57]">
                        무료 등급은 과금이 없지만, 구글이 입력 내용을 서비스 개선(모델 학습·검토)에 활용할 수 있습니다. 유료 등급은 그렇지 않습니다. 학생 개인정보를 다루신다면 유료 등급 키 사용을 검토해 주세요.
                      </p>
                      <label className="block text-xs font-bold text-[#78716C] dark:text-[#9C8F87] mb-1">무료 Gmail API 키</label>
                      {hasApiKey && (
                        <p className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                          저장된 API 키가 있습니다. 보안상 키 원문은 다시 표시하지 않으며, 변경할 때만 새 키를 입력하세요.
                        </p>
                      )}
                      <input
                        type="password"
                        value={onboardingApiKey}
                        onChange={e => { setOnboardingApiKey(e.target.value); setOnboardingApiStatus('idle'); setOnboardingApiMessage(''); }}
                        className="w-full h-10 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#171210] px-3 text-sm text-[#1C1917] dark:text-[#F0EBE6] outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder={hasApiKey ? '이미 저장된 API 키가 있습니다' : '개인 Gmail 무료 API 키를 붙여넣으세요'}
                      />
                      {(onboardingApiStatus === 'tested' || onboardingApiStatus === 'warning' || onboardingApiStatus === 'saved' || onboardingApiStatus === 'error') && (
                        <div className={`mt-3 rounded-lg border px-3 py-2 text-xs font-semibold ${
                          onboardingApiStatus === 'error'
                            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                        }`}>
                          {onboardingApiMessage}
                        </div>
                      )}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={handleTestOnboardingApiKey}
                          disabled={!onboardingApiKey.trim() || onboardingApiStatus === 'testing'}
                          className="py-3 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] text-sm font-bold text-[#44403C] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {onboardingApiStatus === 'testing' ? '테스트 중...' : '키 테스트'}
                        </button>
                        <button
                          onClick={handleSaveOnboardingApiKey}
                          disabled={!onboardingApiKey.trim() || onboardingApiStatus === 'testing'}
                          className="py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-200 disabled:cursor-not-allowed text-white font-bold rounded-lg text-sm transition-colors"
                        >
                          {onboardingApiStatus === 'testing' ? '확인 중...' : onboardingApiStatus === 'saved' ? '저장 완료' : '저장'}
                        </button>
                      </div>
                      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                        API 키가 없어도 일부 기능은 사용할 수 있습니다.
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#171210] rounded-xl p-5">
                      <p className="text-sm font-black text-[#44403C] dark:text-[#F0EBE6] mb-4">무료 API 키 발급 방법</p>
                      <ol className="space-y-2.5 text-xs text-[#78716C] dark:text-[#9C8F87]">
                        {GEMINI_API_GUIDE_STEPS.map((text, index) => (
                          <li key={text} className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">{index + 1}</span>
                            <span className="leading-relaxed">{text}</span>
                          </li>
                        ))}
                      </ol>
                      <button
                        onClick={handleOpenApiGuide}
                        className="mt-4 w-full py-2 rounded-lg border border-indigo-200 bg-white text-xs font-bold text-indigo-700 hover:bg-indigo-50 dark:bg-[#221E1B] dark:border-indigo-900 dark:text-indigo-300"
                      >
                        발급 페이지 열기
                      </button>
                      <button
                        onClick={handleOpenApiGuideVideo}
                        className="mt-2 w-full py-2 rounded-lg border border-emerald-200 bg-white text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:bg-[#221E1B] dark:border-emerald-900 dark:text-emerald-300 flex items-center justify-center gap-1.5"
                      >
                        <Video className="w-3.5 h-3.5" /> 키 발급 도움받기 (영상)
                      </button>
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 leading-relaxed space-y-1">
                        <p className="font-bold">프로젝트가 보이지 않을 때</p>
                        <p><strong>프로젝트</strong>에서 이름을 <strong>edunote</strong>로 새 프로젝트를 만든 뒤, <strong>프로젝트 가져오기</strong>에서 방금 만든 프로젝트를 선택하세요.</p>
                        <p className="text-amber-500 dark:text-amber-400">그 다음 API 키 화면에서 키를 만들고 복사해 EduNote에 붙여넣으세요.</p>
                      </div>
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white dark:border-[#2E2822] dark:bg-[#221E1B] overflow-hidden">
                        <button
                          onClick={() => setOnboardingShowCloudAlt(v => !v)}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-[#44403C] dark:text-[#F0EBE6] hover:bg-slate-50 dark:hover:bg-[#171210]"
                        >
                          <span>Google Cloud 대안 방법</span>
                          <span className="text-[#A8A29E] dark:text-[#6B5E57] text-[10px]">{onboardingShowCloudAlt ? '▲ 접기' : '▼ 펼치기'}</span>
                        </button>
                        {onboardingShowCloudAlt && (
                          <ol className="px-3 pb-3 space-y-1 text-xs text-[#78716C] dark:text-[#9C8F87] leading-relaxed list-decimal list-inside">
                            {GEMINI_API_CLOUD_FALLBACK_STEPS.map(step => (
                              <li key={step}>{step}</li>
                            ))}
                          </ol>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {onboardingStep === 3 && (
                  <div>
                    <h3 className="text-lg font-black text-[#1C1917] dark:text-[#F0EBE6] mb-1">기본 정보 입력</h3>
                    <p className="text-sm text-[#78716C] dark:text-[#9C8F87] mb-7">입력한 정보는 공문서와 수업자료 생성 시 자동으로 활용됩니다.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                      <div>
                        <label className="block text-xs font-bold text-[#78716C] dark:text-[#9C8F87] mb-1">이름</label>
                        <input
                          type="text"
                          value={onboardingTeacherName}
                          onChange={e => setOnboardingTeacherName(e.target.value)}
                          className="w-full h-10 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#171210] px-3 text-sm text-[#1C1917] dark:text-[#F0EBE6] outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="예: 홍길동"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#78716C] dark:text-[#9C8F87] mb-1">소속기관</label>
                        <input
                          type="text"
                          value={onboardingInstitution}
                          onChange={e => setOnboardingInstitution(e.target.value)}
                          className="w-full h-10 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#171210] px-3 text-sm text-[#1C1917] dark:text-[#F0EBE6] outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="예: 충북초등학교"
                        />
                      </div>
                    </div>
                    <label className="block text-xs font-bold text-[#78716C] dark:text-[#9C8F87] mb-2">기본 학교급</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[SchoolLevel.ELEMENTARY, SchoolLevel.MIDDLE, SchoolLevel.HIGH].map(level => (
                        <button
                          key={level}
                          onClick={() => handleSchoolLevelSelect(level)}
                          className={`py-2.5 text-sm font-bold rounded-lg border transition-colors ${
                            schoolLevel === level
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                              : 'border-[#E7E5E4] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:border-indigo-300'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    <div className="mt-5">
                      <label className="block text-xs font-bold text-[#78716C] dark:text-[#9C8F87] mb-1">담당 학년/반</label>
                      <input
                        type="text"
                        value={onboardingGradeClass}
                        onChange={e => setOnboardingGradeClass(e.target.value)}
                        className="w-full h-10 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#171210] px-3 text-sm text-[#1C1917] dark:text-[#F0EBE6] outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="예: 5학년 2반"
                      />
                    </div>
                    <button
                      onClick={handleSaveOnboardingProfile}
                      className="mt-6 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
                    >
                      기본 정보 저장
                    </button>
                  </div>
                )}
              </div>
              <div className="px-8 py-5 border-t border-[#EDE8E1] dark:border-[#2E2822] flex items-center justify-between">
                <button
                  onClick={() => setOnboardingStep(step => Math.max(1, step - 1))}
                  disabled={onboardingStep === 1}
                  className="px-5 py-2.5 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] text-sm font-bold text-[#78716C] dark:text-[#9C8F87] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]"
                >
                  ← 이전 단계
                </button>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3].map(step => (
                    <span key={step} className={`w-2 h-2 rounded-full ${onboardingStep === step ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-[#2E2822]'}`} />
                  ))}
                </div>
                {onboardingStep < 3 ? (
                  <div className="flex items-center gap-2">
                    {onboardingStep === 1 && (
                      <button
                        onClick={handleStartAfterDisclaimer}
                        disabled={!disclaimerChecked}
                        className="px-4 py-2.5 rounded-lg border border-indigo-200 bg-white text-indigo-700 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-50 dark:bg-[#171210] dark:border-indigo-900/60 dark:text-indigo-200 dark:hover:bg-indigo-950/30"
                      >
                        동의하고 창 닫기
                      </button>
                    )}
                    <button
                      onClick={() => setOnboardingStep(step => Math.min(3, step + 1))}
                      disabled={onboardingStep === 1 && !disclaimerChecked}
                      className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold disabled:bg-indigo-200 disabled:cursor-not-allowed hover:bg-indigo-700"
                    >
                      다음 단계 →
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleFinishOnboarding}
                    className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
                  >
                    EduNote 시작하기 →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {showApiKeyLimitModal && !showDisclaimerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="apikey-modal-title">
            <div className="bg-white dark:bg-[#221E1B] rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h2 id="apikey-modal-title" className="text-lg font-black text-[#1C1917] dark:text-[#F0EBE6]">API 키가 설정되지 않았습니다</h2>
                  <p className="text-sm text-[#78716C] dark:text-[#9C8F87] mt-1 leading-relaxed">
                    EduNote는 계속 사용할 수 있지만, 학생기록 작성, 공문 작성, 예산안 AI 생성처럼 Gemini를 사용하는 기능은 제한됩니다.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 mb-4">
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-2">무료 API 키 발급 방법</p>
                <ol className="space-y-1.5 text-xs text-amber-800 dark:text-amber-100 leading-relaxed">
                  {GEMINI_API_GUIDE_STEPS.map((step, index) => (
                    <li key={step}>{index + 1}. {step}</li>
                  ))}
                </ol>
                <p className="mt-2 text-xs font-bold text-amber-900 dark:text-amber-100">두 번째 대안: Google Cloud에서 발급할 수도 있습니다.</p>
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
                  className="flex-1 py-2.5 bg-white dark:bg-[#171210] border border-[#E7E5E4] dark:border-[#2E2822] text-[#44403C] dark:text-[#C4B8B0] font-bold rounded-xl text-sm hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420] transition-colors"
                >
                  발급 페이지 열기
                </button>
                <button
                  onClick={() => setShowApiKeyLimitModal(false)}
                  className="py-2.5 px-4 text-[#78716C] dark:text-[#9C8F87] hover:text-[#1C1917] dark:hover:text-[#F0EBE6] text-sm font-semibold"
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
            <div className="bg-white dark:bg-[#221E1B] border border-blue-200 dark:border-blue-700 rounded-xl shadow-lg p-4 flex gap-3 items-start">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg shrink-0">
                <Info className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#1C1917] dark:text-[#F0EBE6] mb-0.5">동시 생성 안내</p>
                <p className="text-xs text-[#78716C] dark:text-[#9C8F87] leading-relaxed">
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
                  className="p-1.5 text-[#A8A29E] hover:text-[#44403C] dark:hover:text-[#C4B8B0] rounded-lg transition-colors"
                ><X className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        )}

        {/* School Level Modal */}
        {showSchoolLevelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="schoollevel-modal-title">
            <div className="bg-white dark:bg-[#221E1B] rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
              <div className="flex items-center gap-2 mb-2">
                <School className="w-5 h-5 text-blue-500" />
                <h2 id="schoollevel-modal-title" className="text-lg font-bold text-[#1C1917] dark:text-[#F0EBE6]">학교급 선택</h2>
              </div>
              <p className="text-sm text-[#78716C] dark:text-[#9C8F87] mb-5">학생기록 AI는 학교급에 따라 다른 결과를 생성합니다.</p>
              <div className="space-y-2">
                {[SchoolLevel.ELEMENTARY, SchoolLevel.MIDDLE, SchoolLevel.HIGH].map(level => (
                  <button
                    key={level}
                    onClick={() => handleSchoolLevelSelect(level)}
                    className="w-full py-3 text-sm font-bold rounded-lg border-2 border-[#EDE8E1] dark:border-[#2E2822] hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:text-[#C4B8B0] transition-all"
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 사이드바가 접혀 있을 때: 주요 메뉴 아이콘을 남기는 얇은 바 */}
        {sidebarCollapsed && (
          <div className="w-12 shrink-0 bg-[#FFFDF9] dark:bg-[#1D1916] border-r border-[#EDE8E1] dark:border-[#2E2822] flex flex-col items-center py-3 gap-2">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420] transition-colors"
              title="메뉴 펼치기"
              aria-label="메뉴 펼치기"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
            <div className="h-px w-7 bg-[#EDE8E1] dark:bg-[#2E2822]" />
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-1 px-1">
              {collapsedNavItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={item.onClick}
                    className={`relative h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors ${
                      item.active
                        ? 'bg-[#1C1917] dark:bg-[#2A2420] text-white dark:text-[#F0EBE6]'
                        : 'text-[#78716C] dark:text-[#9C8F87] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]'
                    }`}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <Icon className="w-4 h-4" />
                    {item.progress && (
                      <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-emerald-500 px-1 text-[8px] font-black leading-4 text-white shadow-sm">
                        {item.progress}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Sidebar */}
        <aside className={`${sidebarCollapsed ? 'hidden' : 'flex'} min-w-[240px] w-[19%] max-w-[280px] bg-[#FFFDF9] dark:bg-[#1D1916] border-r border-[#EDE8E1] dark:border-[#2E2822] flex-col shrink-0 overflow-hidden`}>

          <div className="h-14 flex items-center justify-between px-4 border-b border-[#EDE8E1] dark:border-[#2E2822] shrink-0">
            <button
              onClick={() => goTo(AppMode.HOME)}
              className="flex items-baseline gap-1.5 text-lg font-extrabold text-[#1C1917] dark:text-[#F0EBE6] tracking-tight hover:text-blue-600 dark:hover:text-indigo-400 transition-colors"
            >
              <span>EduNote</span>
              {appVersion && <span className="text-[10px] font-bold text-[#A8A29E] dark:text-[#6B5E57]">v{appVersion}</span>}
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleDarkMode}
                className="p-1.5 rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-amber-500 dark:text-amber-400 hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420] transition-colors"
                title={darkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
                aria-label={darkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-[#78716C]" />}
              </button>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="p-1.5 rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420] transition-colors"
                title="메뉴 접기"
                aria-label="메뉴 접기"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          <nav className="flex-1 min-h-0 overflow-y-auto py-3 px-2 space-y-1">

            <button
              onClick={() => goTo(AppMode.HOME)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-base rounded-md transition-all cursor-pointer ${
                mode === AppMode.HOME
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-[#78716C] dark:text-[#9C8F87] hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300'
              }`}
            >
              <Home className="w-4 h-4 shrink-0" />
              <span className="truncate">홈</span>
            </button>

            <button
              onClick={() => goTo(AppMode.SETTINGS)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-all cursor-pointer ${
                mode === AppMode.SETTINGS
                  ? 'bg-amber-600 text-white font-semibold shadow-sm'
                  : 'text-[#78716C] dark:text-[#9C8F87] hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-300'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span className="truncate">설정</span>
            </button>

            {apiKeyAvailability === 'usable' ? (
              <button
                onClick={() => goTo(AppMode.SETTINGS)}
                className="w-full px-2 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-md text-xs text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors text-left flex items-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">API 사용 가능!</span>
              </button>
            ) : apiKeyAvailability === 'wait' ? (
              <button
                onClick={() => goTo(AppMode.SETTINGS)}
                title="API 키는 저장되어 있지만 현재 요청 제한, 토큰 소모, 잦은 요청, 모델 일시 제한 등으로 결과물을 생성하지 못한 상태입니다. 다른 키를 넣거나 잠시 기다린 뒤 다시 시도해 주세요."
                className="w-full px-2 py-1.5 bg-amber-100 dark:bg-amber-900/30 border border-amber-400 dark:border-amber-500 rounded-md text-xs text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors text-left flex items-center gap-1.5 animate-pulse ring-2 ring-amber-300/70 dark:ring-amber-500/40 shadow-sm"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>API 일시 제한 · 키 변경/잠시 후 재시도</span>
              </button>
            ) : hasApiKey ? (
              <button
                onClick={() => goTo(AppMode.SETTINGS)}
                className="w-full px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-left"
              >
                API 키 저장됨 · 사용 확인 필요
              </button>
            ) : (
              <button
                onClick={() => goTo(AppMode.SETTINGS)}
                className="w-full px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors text-left"
              >
                ⚠ API 키를 설정해 주세요
              </button>
            )}

            <button
              onClick={() => setShowSchoolLevelModal(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] bg-[#EDE8E1] dark:bg-[#2E2822]/40 text-[#78716C] dark:text-[#C4B8B0] hover:bg-[#E7E5E4] dark:hover:bg-[#2E2822]/70 transition-all shadow-sm"
            >
              <School className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left text-sm font-bold truncate">학교급 변경</span>
              <span className="text-[10px] bg-white dark:bg-[#2E2822] border border-[#E7E5E4] dark:border-[#6B5E57] px-1.5 py-0.5 rounded-full font-semibold">{schoolLevel}</span>
            </button>

            <div className="h-px bg-[#EDE8E1] dark:bg-[#2E2822] my-1" />

            {/* ── 즐겨찾기 ── */}
            {favorites.length > 0 && (
              <>
                <div className="rounded-xl overflow-hidden border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20">
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <Star className="w-3.5 h-3.5 shrink-0 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-300 tracking-wide truncate">즐겨찾기</span>
                  </div>
                  <div className="px-1.5 pb-1.5 space-y-0.5">
                    {favorites.map(m => {
                      const item = menuItemByMode.get(m);
                      if (!item) return null;
                      const Icon = item.icon;
                      return (
                        <div key={m} className="flex items-center gap-1 rounded-md">
                          <button onClick={() => navigateMode(m)} title={item.label} className={`min-w-0 flex-1 ${favNavClass(m)}`}>
                            {Icon && <Icon className="w-4 h-4 shrink-0" />}
                            <span className="flex-1 text-left truncate">{item.label}</span>
                          </button>
                          <button onClick={() => toggleFavorite(m)} title="즐겨찾기 해제" className="shrink-0 p-1 text-amber-400 hover:text-amber-600">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="h-1.5" />
              </>
            )}

            {/* ── 교무행정AI ── */}
            <div className="rounded-xl overflow-hidden border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20">
              <button
                onClick={() => setAdminSectionOpen(!adminSectionOpen)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-t-xl transition-colors ${getNavigationSectionHeaderClass('admin')}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-emerald-500 flex items-center justify-center shrink-0">
                    <FileText className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-bold tracking-wide truncate">교무행정AI</span>
                </div>
                {adminSectionOpen ? <ChevronDown className="w-3 h-3 opacity-80" /> : <ChevronRight className="w-3 h-3 opacity-80" />}
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
                      <button onClick={() => toggleFavorite(m)} title={isFavorite(m) ? '즐겨찾기 해제' : '즐겨찾기에 추가'} className="shrink-0 mt-2 text-[#D6D3D1] dark:text-[#6B5E57] hover:text-amber-500">
                        <Star className={`w-3.5 h-3.5 ${isFavorite(m) ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                      {m === AppMode.SCHOOL_DOC ? (
                        <button onClick={handleSchoolDocParent} className={`min-w-0 flex-1 ${adminNavClass(AppMode.SCHOOL_DOC, true)}`}>
                          {Icon && <Icon className="w-4 h-4 shrink-0" />}
                          <span className="flex-1 text-left truncate">{label}</span>
                          {generatingModes.has(AppMode.SCHOOL_DOC) && mode !== AppMode.SCHOOL_DOC && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-200 rounded font-bold shrink-0 tabular-nums">
                              {generatingModes.get(AppMode.SCHOOL_DOC)}%
                            </span>
                          )}
                        </button>
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
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-t-xl transition-colors ${getNavigationSectionHeaderClass('lesson')}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-amber-500 flex items-center justify-center shrink-0">
                    <Presentation className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-bold tracking-wide truncate">수업자료AI</span>
                </div>
                {lessonSectionOpen ? <ChevronDown className="w-3 h-3 opacity-80" /> : <ChevronRight className="w-3 h-3 opacity-80" />}
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
                      <button onClick={() => toggleFavorite(m)} title={isFavorite(m) ? '즐겨찾기 해제' : '즐겨찾기에 추가'} className="shrink-0 mt-2 text-[#D6D3D1] dark:text-[#6B5E57] hover:text-amber-500">
                        <Star className={`w-3.5 h-3.5 ${isFavorite(m) ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                      {m === AppMode.CLASS_TOOLS ? (
                        <button onClick={handleClassToolsParent} className={`min-w-0 flex-1 ${lessonNavClass(AppMode.CLASS_TOOLS, true)}`}>
                          {Icon ? <Icon className="w-4 h-4 shrink-0" /> : <span className="w-4 h-4 shrink-0 flex items-center justify-center text-sm">🎲</span>}
                          <span className="flex-1 text-left truncate">{label}</span>
                        </button>
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
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-t-xl transition-colors ${getNavigationSectionHeaderClass('student')}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-indigo-500 flex items-center justify-center shrink-0">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-bold tracking-wide truncate">학생기록AI</span>
                </div>
                <div className="flex items-center gap-1">
                  {hasEnteredStudentSection && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300">{schoolLevel}</span>
                  )}
                  {studentSectionOpen ? <ChevronDown className="w-3 h-3 opacity-80" /> : <ChevronRight className="w-3 h-3 opacity-80" />}
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
                      <button onClick={() => toggleFavorite(m)} title={isFavorite(m) ? '즐겨찾기 해제' : '즐겨찾기에 추가'} className="shrink-0 mt-2 text-[#D6D3D1] dark:text-[#6B5E57] hover:text-amber-500">
                        <Star className={`w-3.5 h-3.5 ${isFavorite(m) ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                      {m === AppMode.STUDENT_RECORD_GROUP ? (
                        <button
                          onClick={() => handleModeChange(AppMode.GENERATOR)}
                          className={`min-w-0 flex-1 ${studentNavClass(AppMode.STUDENT_RECORD_GROUP)}`}
                        >
                          {Icon && <Icon className="w-4 h-4 shrink-0" />}
                          <span className="flex-1 text-left truncate">{label}</span>
                        </button>
                      ) : m === AppMode.TEACHER_RECORD ? (
                        <button onClick={handleTeacherRecordParent} className={`min-w-0 flex-1 ${studentNavClass(AppMode.TEACHER_RECORD)}`}>
                          {Icon && <Icon className="w-4 h-4 shrink-0" />}
                          <span className="flex-1 text-left truncate">{label}</span>
                        </button>
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
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-t-xl transition-colors ${getNavigationSectionHeaderClass('myTools')}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-pink-500 flex items-center justify-center shrink-0">
                    <Wrench className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-bold tracking-wide truncate">AI 스킬즈</span>
                </div>
                {myToolsSectionOpen ? <ChevronDown className="w-3 h-3 opacity-80" /> : <ChevronRight className="w-3 h-3 opacity-80" />}
              </button>
              {myToolsSectionOpen && (
                <div className="px-1.5 pb-1.5 space-y-0.5">
                  {myToolsMenuItems.map(({ mode: m, icon: Icon, label }) => (
                    <div
                      key={m}
                      draggable
                      onDragStart={() => setDraggedMenu({ section: 'myTools', mode: m })}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleMenuDrop('myTools', m)}
                      onDragEnd={() => setDraggedMenu(null)}
                      className={`flex items-start gap-1 rounded-md ${draggedMenu?.section === 'myTools' && draggedMenu.mode === m ? 'opacity-50' : ''}`}
                    >
                      <GripVertical className="w-3.5 h-3.5 shrink-0 text-pink-400 cursor-grab mt-2.5" />
                      <button onClick={() => toggleFavorite(m)} title={isFavorite(m) ? '즐겨찾기 해제' : '즐겨찾기에 추가'} className="shrink-0 mt-2 text-[#D6D3D1] dark:text-[#6B5E57] hover:text-amber-500">
                        <Star className={`w-3.5 h-3.5 ${isFavorite(m) ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleMyToolsTabChange(m === AppMode.MY_AI_TOOLS_SHARED ? 'market' : 'my')}
                        className={`min-w-0 flex-1 ${myToolsNavClass(m)}`}
                      >
                        {Icon && <Icon className="w-4 h-4 shrink-0" />}
                        <span className="flex-1 text-left truncate">{label}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="border-t border-[#EDE8E1] dark:border-[#2E2822] p-2 shrink-0 space-y-0.5">
            <button
              onClick={() => goTo(AppMode.USAGE_GUIDE)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-base rounded-md transition-all cursor-pointer ${
                mode === AppMode.USAGE_GUIDE
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'text-[#78716C] dark:text-[#9C8F87] hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300'
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
                  : 'text-[#78716C] dark:text-[#9C8F87] hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300'
              }`}
            >
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">도움말 / 정보</span>
            </button>
            <button
              onClick={() => window.electronAPI.openDemoWindow()}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-base rounded-md transition-all cursor-pointer text-[#78716C] dark:text-[#9C8F87] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]"
            >
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span className="truncate">Demo</span>
            </button>
            {/* 글씨 크기 조절 */}
            <div className="flex items-center gap-1 px-2 pt-1">
              <button
                onClick={() => changeFontSize(-5)}
                title="글씨 축소"
                aria-label="글씨 축소"
                className="h-7 w-7 flex items-center justify-center rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#EDE8E1] dark:hover:bg-[#2E2822] transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="flex-1 text-center text-xs text-[#78716C] dark:text-[#9C8F87] tabular-nums select-none">{fontSize}%</span>
              <button
                onClick={() => changeFontSize(5)}
                title="글씨 확대"
                aria-label="글씨 확대"
                className="h-7 w-7 flex items-center justify-center rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#EDE8E1] dark:hover:bg-[#2E2822] transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {fontSize !== 100 && (
                <button
                  onClick={resetFontSize}
                  title="기본 크기로"
                  className="ml-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded border border-[#EDE8E1] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#EDE8E1] dark:hover:bg-[#2E2822] transition-colors"
                >
                  기본
                </button>
              )}
            </div>
          </div>
        </aside>

        <main className="relative flex-1 overflow-hidden flex flex-col">
          <div className={`pointer-events-none absolute inset-x-0 top-0 z-20 h-[3px] bg-gradient-to-r transition-all duration-500 ${contentAccent}`} />
          {topNavItems.length > 0 && (
            <div className="h-14 shrink-0 border-b border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#1D1916] pr-5 overflow-x-auto">
              <div className="flex h-full items-stretch gap-1 min-w-max">
                {topNavItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      onClick={item.onClick}
                      className={`h-full px-4 inline-flex items-center gap-1.5 border-t-2 rounded-t-lg text-sm transition-colors ${
                        item.active
                          ? getNavigationSelectionClass(activeNavigationSection ?? 'student', true)
                          : 'border-transparent text-[#78716C] dark:text-[#9C8F87] hover:text-[#44403C] dark:hover:text-[#C4B8B0] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="whitespace-nowrap">{item.label}</span>
                      {item.progress !== null && (
                        <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums ${
                          item.active
                            ? 'bg-white/20 text-white'
                            : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200'
                        }`}>
                          {item.progress === -1 ? '진행 중' : `${item.progress}%`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* Generation progress banner */}
          {generatingModes.has(mode) && (() => {
            const pct = generatingModes.get(mode) ?? -1;
            const colorBar = STUDENT_RECORD_MODES.includes(mode)
              ? 'from-indigo-400 to-indigo-600'
              : ADMIN_MODES.includes(mode)
              ? 'from-emerald-400 to-emerald-600'
              : LESSON_AI_MODES.includes(mode)
              ? 'from-amber-400 to-amber-600'
              : 'from-[#A8A29E] to-[#78716C]';
            const colorBg = STUDENT_RECORD_MODES.includes(mode)
              ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300'
              : ADMIN_MODES.includes(mode)
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
              : LESSON_AI_MODES.includes(mode)
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900 text-amber-700 dark:text-amber-300'
              : 'bg-[#FAF9F7] dark:bg-[#221E1B] border-[#EDE8E1] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87]';
            const cancelled = isCancelled(mode);
            return (
              <div className={`shrink-0 flex items-center gap-3 px-4 py-1.5 border-b ${colorBg}`}>
                <div className="flex-1 bg-[#EDE8E1] dark:bg-[#2E2822] rounded-full h-1.5 overflow-hidden">
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
          {(Array.from(mountedModes) as AppMode[]).map(m => {
            const isVisible = m === mode || (m === AppMode.MY_AI_TOOLS && mode === AppMode.MY_AI_TOOLS_SHARED);
            return (
              <div key={m} className={isVisible ? 'flex-1 overflow-hidden flex flex-col' : 'hidden'}>
                {renderMode(m)}
              </div>
            );
          })}
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
    </TourProvider>
  );
};

export default App;
