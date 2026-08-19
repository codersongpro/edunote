import React, { useState, useEffect, useRef } from 'react';
import { Settings, Key, Save, CheckCircle, AlertCircle, AlertTriangle, ExternalLink, ChevronDown, ChevronUp, Folder, User, School, Users, Download, Upload, Video, Trash2 } from 'lucide-react';
import { SchoolLevel } from '../types';
import { useGlobalState } from '../GlobalStateContext';
import { playSuccessSound } from '../lib/soundEffect';
import { API_KEY_UPDATED_EVENT, GEMINI_API_CLOUD_FALLBACK_STEPS, GEMINI_API_GUIDE_STEPS, GEMINI_API_GUIDE_VIDEO_URL } from '../lib/apiKeyGuide';
import { notifyToast } from '../lib/toast';
import { clearAllHistory, clearDocumentHistory } from '../lib/generationHistory';
import { DEFAULT_BYTE_LIMITS, RECORD_KINDS, RecordKind, parseByteLimits, isValidByteLimit } from '../lib/textLength';

const BYTE_LIMIT_LABELS: Record<RecordKind, string> = {
  opinion: '행동특성',
  subject: '교과 세특',
  creative: '창체',
  sports: '스포츠클럽',
};

const SettingsScreen: React.FC = () => {
  const { showToast, setApiKeyAvailability, showActivationModal, resetGenerationState } = useGlobalState();
  const [apiKey, setApiKey] = useState('');
  const [paidApiKey, setPaidApiKey] = useState('');
  const [apiTier, setApiTier] = useState<'free' | 'paid'>('free');
  const [teacherName, setTeacherName] = useState('');
  const [institution, setInstitution] = useState('');
  const [schoolLevel, setSchoolLevel] = useState<string>(SchoolLevel.HIGH);
  const [gradeClass, setGradeClass] = useState('');
  const [studentNames, setStudentNames] = useState('');
  const [studentMaleNames, setStudentMaleNames] = useState('');
  const [studentFemaleNames, setStudentFemaleNames] = useState('');
  const [saveDir, setSaveDir] = useState('');
  const [appDataDir, setAppDataDir] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'warn' | 'fail'>('idle');
  const [testError, setTestError] = useState('');
  const [testWarn, setTestWarn] = useState('');
  const [saved, setSaved] = useState(false);
  const [guideExpanded, setGuideExpanded] = useState(false);
  const [backupStatus, setBackupStatus] = useState('');
  const [autoBackupInterval, setAutoBackupInterval] = useState<'off' | 'daily' | 'weekly'>('off');
  const [privacyModeEnabled, setPrivacyModeEnabled] = useState(true);
  const [reviewChecklistEnabled, setReviewChecklistEnabled] = useState(true);
  const [cautionTerms, setCautionTerms] = useState('');
  const [byteLimits, setByteLimits] = useState<Record<RecordKind, number>>(DEFAULT_BYTE_LIMITS);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [hn, tn, inst, sl, gc, stNames, stMale, stFemale, sd, add, tier, privacyMode, reviewChecklist, cautionTermList, autoBackup, rawByteLimits] = await Promise.all([
        window.electronAPI.hasApiKey(),
        window.electronAPI.getConfig('teacherName'),
        window.electronAPI.getConfig('institution'),
        window.electronAPI.getConfig('schoolLevel'),
        window.electronAPI.getConfig('gradeClass'),
        window.electronAPI.getConfig('studentNames'),
        window.electronAPI.getConfig('studentMaleNames'),
        window.electronAPI.getConfig('studentFemaleNames'),
        window.electronAPI.getConfig('saveDir'),
        window.electronAPI.getConfig('appDataDir'),
        window.electronAPI.getConfig('apiTier'),
        window.electronAPI.getConfig('privacyModeEnabled'),
        window.electronAPI.getConfig('reviewChecklistEnabled'),
        window.electronAPI.getConfig('cautionTerms'),
        window.electronAPI.getConfig('autoBackupInterval'),
        window.electronAPI.getConfig('neisByteLimits'),
      ]);
      if (cancelled) return;
      setHasKey(hn as boolean);
      setTeacherName(tn as string || '');
      setInstitution(inst as string || '');
      setSchoolLevel((sl as string) || SchoolLevel.HIGH);
      setGradeClass(gc as string || '');
      setStudentNames(stNames as string || '');
      setStudentMaleNames(stMale as string || '');
      setStudentFemaleNames(stFemale as string || '');
      setSaveDir(sd as string || '');
      setAppDataDir(add as string || '');
      setApiTier((tier as 'free' | 'paid') || 'free');
      setPrivacyModeEnabled(privacyMode !== false);
      setReviewChecklistEnabled(reviewChecklist !== false);
      setCautionTerms(cautionTermList as string || '');
      setAutoBackupInterval((autoBackup as 'off' | 'daily' | 'weekly') || 'off');
      setByteLimits(parseByteLimits(rawByteLimits));
      setGuideExpanded(!(hn as boolean));
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleTestKey = async () => {
    const key = apiTier === 'paid' ? paidApiKey : apiKey;
    setTestStatus('testing');
    setTestError('');
    setTestWarn('');
    try {
      const result = (key.trim()
        ? await window.electronAPI.testApiKey(key.trim(), apiTier)
        : await window.electronAPI.testStoredApiKey()
      ) as { ok: boolean; warning?: string; error?: string; wait?: boolean };
      if (result?.ok) {
        if (result.warning) {
          setTestStatus('warn');
          setTestWarn(result.warning);
          if (!result.wait) { setApiKeyAvailability('usable'); resetGenerationState(); }
          else setApiKeyAvailability('wait');
        } else {
          setTestStatus('ok');
          setApiKeyAvailability('usable');
          resetGenerationState();
        }
      } else {
        setTestStatus('fail');
        setApiKeyAvailability(result?.wait ? 'wait' : 'unknown');
        setTestError(result?.error || 'API 키가 유효하지 않습니다.');
      }
    } catch (e) {
      setTestStatus('fail');
      setTestError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    }
  };

  const handleSaveKey = async () => {
    const key = apiTier === 'paid' ? paidApiKey : apiKey;
    if (!key.trim()) return;

    // 아직 테스트 통과 상태가 아니면 자동으로 테스트 먼저 실행
    if (testStatus !== 'ok' && testStatus !== 'warn') {
      setTestStatus('testing');
      setTestError('');
      setTestWarn('');
      try {
        const result = await window.electronAPI.testApiKey(key.trim(), apiTier) as { ok: boolean; warning?: string; error?: string; wait?: boolean };
        if (!result?.ok) {
          setTestStatus('fail');
          setApiKeyAvailability(result?.wait ? 'wait' : 'unknown');
          setTestError(result?.error || 'API 키가 유효하지 않습니다.');
          return; // 저장 차단
        }
        if (result.warning) {
          setTestStatus('warn');
          setTestWarn(result.warning);
          if (!result.wait) { setApiKeyAvailability('usable'); resetGenerationState(); }
          else setApiKeyAvailability('wait');
        } else {
          setTestStatus('ok');
          setApiKeyAvailability('usable');
          resetGenerationState();
        }
      } catch (e) {
        setTestStatus('fail');
        setTestError(e instanceof Error ? e.message : '오류가 발생했습니다.');
        return; // 저장 차단
      }
    }

    const { usedPlaintext } = await window.electronAPI.setApiKey(key.trim(), apiTier);
    if (usedPlaintext) {
      notifyToast({ type: 'warning', title: '이 컴퓨터의 암호화 저장소를 사용할 수 없어 API 키가 암호화 없이 저장되었습니다.' });
    }
    await window.electronAPI.setConfig({ apiKeyLastUsable: true });
    setHasKey(true);
    setApiKey('');
    setPaidApiKey('');
    setTestStatus('idle');
    setGuideExpanded(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);

    // testApiKey가 이미 실제 생성 가능 여부를 확인했으므로 즉시 사용 가능 처리
    setApiKeyAvailability('usable');
    resetGenerationState();
    window.dispatchEvent(new CustomEvent(API_KEY_UPDATED_EVENT));
    playSuccessSound();
    showActivationModal();
  };

  const handleSaveSettings = async () => {
    await window.electronAPI.setConfig({
      teacherName,
      institution,
      schoolLevel,
      gradeClass,
      studentNames,
      studentMaleNames,
      studentFemaleNames,
      privacyModeEnabled,
      reviewChecklistEnabled,
      cautionTerms,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleStudentNamesPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const alreadyNumbered = lines.every(l => /^\d+[.\s)]/.test(l));
    if (!alreadyNumbered && lines.length > 0) {
      e.preventDefault();
      const existing = studentNames.split('\n').filter(l => l.trim().length > 0);
      const startNum = existing.length + 1;
      const numbered = lines.map((name, i) => `${startNum + i}. ${name}`).join('\n');
      setStudentNames(existing.length > 0 ? studentNames.trimEnd() + '\n' + numbered : numbered);
    }
  };

  const handleSelectFolder = async () => {
    const dir = await window.electronAPI.selectFolder();
    if (dir) {
      setSaveDir(dir as string);
      await window.electronAPI.setConfig({ saveDir: dir });
    }
  };

  const handleSelectAppDataFolder = async () => {
    const dir = await window.electronAPI.selectFolder();
    if (dir) {
      setAppDataDir(dir as string);
      await window.electronAPI.setConfig({ appDataDir: dir });
    }
  };

  const handleOpenAiStudio = () => {
    window.electronAPI.openExternal('https://aistudio.google.com');
  };

  const handleOpenApiGuideVideo = () => {
    window.electronAPI.openExternal(GEMINI_API_GUIDE_VIDEO_URL);
  };

  // 렌더러 localStorage 전체를 {키:값} 형태로 수집합니다. (공문 히스토리·메뉴 순서·즐겨찾기 등)
  const collectLocalStorage = (): Record<string, string> => {
    const dump: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null) continue;
      const value = localStorage.getItem(key);
      if (value !== null) dump[key] = value;
    }
    return dump;
  };

  const handleExportBackup = async () => {
    try {
      const savedPath = await window.electronAPI.exportBackup(collectLocalStorage());
      if (savedPath) {
        const backupTime = new Date().toISOString();
        await window.electronAPI.setConfig({ lastBackupAt: backupTime });
        window.dispatchEvent(new CustomEvent('edunote:backup-done', { detail: { lastBackupAt: backupTime } }));
        setBackupStatus('전체 자료 백업을 저장했습니다.');
      }
    } catch (error) {
      setBackupStatus(error instanceof Error ? error.message : '백업 저장 중 오류가 발생했습니다.');
    }
  };

  const handleImportBackup = async () => {
    if (!window.confirm('백업 파일을 불러오면 현재 설정과 앱 자료가 백업 내용으로 덮어써집니다. 계속할까요?')) return;
    try {
      const loaded = await window.electronAPI.importBackup();
      if (loaded) {
        // 구버전 백업은 localStorage가 비어 있으므로 키가 있을 때만 덮어씁니다.
        const restored = loaded.localStorage;
        if (restored && Object.keys(restored).length > 0) {
          localStorage.clear();
          for (const [key, value] of Object.entries(restored)) {
            localStorage.setItem(key, value);
          }
          setBackupStatus('백업 자료를 불러왔습니다. 잠시 후 화면을 새로고침합니다.');
          setTimeout(() => window.location.reload(), 1200);
        } else {
          setBackupStatus('백업 자료를 불러왔습니다. 앱을 다시 실행하면 모든 화면에 반영됩니다.');
        }
      }
    } catch (error) {
      setBackupStatus(error instanceof Error ? error.message : '백업 불러오기 중 오류가 발생했습니다.');
    }
  };

  // 학생 데이터 전체 삭제 — 되돌릴 수 없는 작업이라 두 번 확인을 받는다.
  // 삭제 대상: 학생별 생성 이력(eduHist_*), 문서 생성 이력, 학생 메모, 설정에 저장된 학생 명단.
  // 새 저장소가 추가되면 이 목록에도 함께 반영해야 한다.
  const [isClearingStudentData, setIsClearingStudentData] = useState(false);
  const handleClearStudentData = async () => {
    const firstConfirm = window.confirm(
      '학생 관련 데이터를 모두 삭제합니다.\n\n' +
      '- 학생별 생성 이력(행발·세특·스포츠클럽·창체 등)\n' +
      '- 상담일지·수업관찰기록 등 문서 생성 이력\n' +
      '- 학생 메모 보드의 모든 메모\n' +
      '- 설정에 저장된 학생 명단\n\n' +
      '자료실·나만의 스킬·공문 보관함 등 다른 자료는 삭제되지 않습니다. 계속할까요?'
    );
    if (!firstConfirm) return;
    const secondConfirm = window.confirm('되돌릴 수 없는 작업입니다. 정말로 삭제할까요?');
    if (!secondConfirm) return;

    setIsClearingStudentData(true);
    try {
      clearAllHistory();
      clearDocumentHistory();
      localStorage.removeItem('eduNote_studentMemos_v1');
      await window.electronAPI.writeJsonData('student-memos', []);
      await window.electronAPI.setConfig({ studentNames: '', studentMaleNames: '', studentFemaleNames: '' });
      notifyToast({ type: 'success', title: '학생 관련 데이터를 모두 삭제했습니다.' });
    } catch (error) {
      notifyToast({ type: 'warning', title: error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.' });
    } finally {
      setIsClearingStudentData(false);
    }
  };

  const inputClass = 'w-full bg-white dark:bg-[#171210] rounded-md border border-[#E7E5E4] dark:border-[#2E2822] text-[#1C1917] dark:text-[#F0EBE6] text-sm focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] outline-none p-2.5 transition-all';
  const labelClass = 'block text-sm font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1.5';

  return (
    <div className="flex flex-col h-full bg-[#FAF9F7] dark:bg-[#171210] overflow-y-auto">
      <div className="max-w-xl mx-auto w-full p-4 space-y-4">

        {/* Header */}
        <div className="bg-white dark:bg-[#221E1B] rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-[#EDE8E1] dark:bg-[#2E2822] p-1.5 rounded-lg">
              <Settings className="w-4 h-4 text-[#78716C] dark:text-[#9C8F87]" />
            </div>
            <h2 className="font-bold text-[#1C1917] dark:text-[#F0EBE6]">EduNote 설정</h2>
          </div>
          <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">Gemini API 키와 기본 정보를 설정합니다.</p>
        </div>

        {/* API Key Guide */}
        <div className={`rounded-lg border shadow-sm ${!hasKey ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700' : 'border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B]'}`}>
          <button
            onClick={() => setGuideExpanded(!guideExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className={`w-4 h-4 ${!hasKey ? 'text-blue-600 dark:text-blue-400' : 'text-[#78716C] dark:text-[#9C8F87]'}`} />
              <span className={`text-sm font-bold ${!hasKey ? 'text-blue-800 dark:text-blue-300' : 'text-[#44403C] dark:text-[#C4B8B0]'}`}>
                Gemini API 키 무료 발급 방법
              </span>
              {!hasKey && <span className="text-xs bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full font-medium">필수</span>}
            </div>
            {guideExpanded ? <ChevronUp className="w-4 h-4 text-[#A8A29E] dark:text-[#6B5E57]" /> : <ChevronDown className="w-4 h-4 text-[#A8A29E] dark:text-[#6B5E57]" />}
          </button>
          {guideExpanded && (
            <div className="px-4 pb-4">
              <div className="bg-white dark:bg-[#221E1B] rounded-md border border-blue-100 dark:border-blue-800 p-4 space-y-3">
                <ol className="space-y-2.5 text-sm text-[#44403C] dark:text-[#C4B8B0]">
                  {GEMINI_API_GUIDE_STEPS.map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex-shrink-0 w-5 h-5 bg-[#1E88E5] text-white text-xs rounded-full flex items-center justify-center font-bold">{index + 1}</span>
                      <span>
                        {step}
                        {index === 0 && (
                          <button
                            onClick={handleOpenAiStudio}
                            className="ml-1 text-blue-600 hover:underline font-medium inline-flex items-center gap-0.5"
                          >
                            열기 <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>

                <button
                  onClick={handleOpenApiGuideVideo}
                  className="w-full py-2 rounded-md border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-[#221E1B] text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center justify-center gap-1.5"
                >
                  <Video className="w-3.5 h-3.5" /> 키 발급 도움받기 (영상)
                </button>

                {/* 무료 등급 확인 강조 박스 — 결제 등급이 잘못되면 과금 우려가 있어 별도 안내 */}
                <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md p-3">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1.5 flex items-center gap-1">
                    💰 발급 후 반드시 "무료 등급"인지 확인하세요
                  </p>
                  <ol className="text-xs text-amber-700 dark:text-amber-400 space-y-1 leading-relaxed pl-4 list-decimal">
                    <li>aistudio.google.com → 좌측 메뉴 <strong>"API 키"</strong> 목록 화면 열기</li>
                    <li>방금 만든 키의 <strong>"결제 설정"</strong> 컬럼 확인</li>
                    <li><span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-1.5 py-0.5 rounded font-bold">무료 등급</span>이면 OK — 분당 15회 / 일 1500회까지 무료</li>
                    <li><span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-1.5 py-0.5 rounded font-bold">유료 등급</span>이면 사용량 따라 과금 → 결제 계정 미연결된 새 프로젝트에서 키를 다시 발급</li>
                  </ol>
                  <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-2">
                    팁: 신규 Gmail 계정으로 처음 발급하면 자동으로 무료 등급이 됩니다.
                  </p>
                </div>

                {/* 무료/유료 등급의 데이터 취급 방침 차이 안내 — 학생 개인정보를 다루는 앱이라 등급 선택에 영향을 줄 수 있음 */}
                <div className="mt-3 bg-slate-50 dark:bg-[#171210] border border-[#E7E5E4] dark:border-[#2E2822] rounded-md p-3">
                  <p className="text-xs text-[#78716C] dark:text-[#9C8F87] leading-relaxed">
                    무료 등급은 과금이 없지만, 구글이 입력 내용을 서비스 개선(모델 학습·검토)에 활용할 수 있습니다. 유료 등급은 그렇지 않습니다. 학생 개인정보를 다루신다면 유료 등급 키 사용을 검토해 주세요.
                  </p>
                </div>

                <div className="mt-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-md p-3">
                  <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-1.5">
                    프로젝트가 하나도 없을 때
                  </p>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                    왼쪽 <strong>프로젝트</strong> 메뉴에서 <strong>프로젝트 만들기</strong>를 누르고 이름을 <strong>edunote</strong>로 입력하세요.
                    만든 뒤에는 <strong>프로젝트 가져오기(Select a Cloud Project)</strong>에서 방금 만든 <strong>edunote</strong> 프로젝트를 선택하고, <strong>키 만들기</strong>로 API 키를 생성하면 됩니다.
                  </p>
                </div>

                <div className="mt-3 bg-slate-50 dark:bg-[#171210] border border-slate-200 dark:border-[#2E2822] rounded-md p-3">
                  <p className="text-xs font-bold text-[#44403C] dark:text-[#F0EBE6] mb-1.5">
                    Google Cloud 대안 방법
                  </p>
                  <ol className="text-xs text-[#78716C] dark:text-[#9C8F87] space-y-1.5 leading-relaxed pl-4 list-decimal">
                    {GEMINI_API_CLOUD_FALLBACK_STEPS.map(step => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>

                <div className="mt-3 pt-3 border-t border-[#EDE8E1] dark:border-[#2E2822]">
                  <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">
                    참고: 무료 계정 기준 분당 15회 요청 제한 — 일반 사용에 충분합니다.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* API Key Input */}
        <div className={`rounded-lg border shadow-sm p-4 space-y-3 transition-all ${!hasKey ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-600 animate-pulse' : 'bg-white dark:bg-[#221E1B] border-[#EDE8E1] dark:border-[#2E2822]'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Key className={`w-4 h-4 ${!hasKey ? 'text-amber-600 dark:text-amber-400' : 'text-[#78716C] dark:text-[#9C8F87]'}`} />
            <h3 className={`text-sm font-bold ${!hasKey ? 'text-amber-800 dark:text-amber-300' : 'text-[#44403C] dark:text-[#C4B8B0]'}`}>API 키 설정</h3>
            {!hasKey && (
              <span className="flex items-center gap-1 text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full font-bold">
                ⚠ 미입력
              </span>
            )}
            {hasKey && (
              <span className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                <CheckCircle className="w-3 h-3" />
                등록됨
              </span>
            )}
          </div>

          {hasKey && (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2.5 rounded-md border border-green-100 dark:border-green-800">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>API 키가 안전하게 저장되어 있습니다. 변경하려면 새 키를 입력하세요.</span>
            </div>
          )}

          <div>
            <label className={labelClass}>API 사용 방식</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setApiTier('free'); window.electronAPI.setConfig({ apiTier: 'free' }); setTestStatus('idle'); }}
                className={`rounded-md border p-2.5 text-left text-sm transition-all ${apiTier === 'free' ? 'border-green-500 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'border-[#E7E5E4] text-[#78716C] dark:border-[#2E2822] dark:text-[#9C8F87]'}`}
              >
                <span className="block font-bold">무료 Gmail 기본</span>
              </button>
              <button
                onClick={() => { setApiTier('paid'); window.electronAPI.setConfig({ apiTier: 'paid' }); setTestStatus('idle'); }}
                className={`rounded-md border p-2.5 text-left text-sm transition-all ${apiTier === 'paid' ? 'border-purple-500 bg-purple-50 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300' : 'border-[#E7E5E4] text-[#78716C] dark:border-[#2E2822] dark:text-[#9C8F87]'}`}
              >
                <span className="block font-bold">유료 API</span>
              </button>
            </div>
            {apiTier === 'paid' && (
              <div className="mt-2 rounded-md border border-purple-200 bg-purple-50 p-2.5 text-xs text-purple-700 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
                유료 API 키는 Google Cloud/AI Studio 결제 프로젝트에서 과금될 수 있습니다. 비용과 한도는 Google 계정 설정을 확인한 뒤 사용하세요.
              </div>
            )}
          </div>

          <div>
            <label className={`${labelClass} flex items-center gap-2`}>
              <span>{apiTier === 'paid' ? '유료 API 키' : '무료 Gmail API 키'} {!hasKey && <span className="text-red-500">*</span>}</span>
              {hasKey && (
                <span className="flex items-center gap-1 text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700 rounded-full px-2 py-0.5">
                  <CheckCircle className="w-3 h-3" />
                  API 키 설정 완료
                </span>
              )}
            </label>
            <input
              type="password"
              className={inputClass}
              placeholder={apiTier === 'paid' ? '유료 결제 프로젝트의 API 키를 붙여넣으세요' : '개인 Gmail 무료 API 키를 붙여넣으세요'}
              value={apiTier === 'paid' ? paidApiKey : apiKey}
              onChange={e => { apiTier === 'paid' ? setPaidApiKey(e.target.value) : setApiKey(e.target.value); setTestStatus('idle'); }}
            />
          </div>

          {testStatus === 'ok' && (
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2.5 rounded-md border border-green-100 dark:border-green-800 text-sm">
              <CheckCircle className="w-4 h-4" />
              API 사용 가능!
            </div>
          )}
          {testStatus === 'warn' && (
            <div className="flex items-start gap-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2.5 rounded-md border border-green-100 dark:border-green-800 text-sm">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">API 사용 가능!</p>
                <p className="text-xs mt-0.5 text-green-600 dark:text-green-500">{testWarn}</p>
              </div>
            </div>
          )}
          {testStatus === 'fail' && (
            <div className="flex items-start gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2.5 rounded-md border border-red-100 dark:border-red-800 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="whitespace-pre-line">{testError}</span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleTestKey}
              disabled={(!( apiTier === 'paid' ? paidApiKey : apiKey).trim() && !hasKey) || testStatus === 'testing'}
              className="flex-1 py-2.5 rounded-md text-sm font-bold border border-[#E7E5E4] dark:border-[#2E2822] text-[#44403C] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {testStatus === 'testing' ? '테스트 중...' : '키 테스트'}
            </button>
            <button
              onClick={handleSaveKey}
              disabled={!(apiTier === 'paid' ? paidApiKey : apiKey).trim() || testStatus === 'testing'}
              className="flex-1 py-2.5 rounded-md text-sm font-bold bg-[#1E88E5] text-white hover:bg-[#1565C0] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {testStatus === 'testing' ? '확인 중...' : saved ? '저장 완료!' : 'API 키 저장'}
            </button>
          </div>
          {hasKey && (
            <button
              onClick={async () => {
                if (!window.confirm('저장된 API 키를 삭제하시겠습니까?')) return;
                await window.electronAPI.deleteApiKey(apiTier);
                await window.electronAPI.setConfig({ apiKeyLastUsable: false });
                setHasKey(false);
                setApiKey('');
                setTestStatus('idle');
                setApiKeyAvailability('unknown');
                setGuideExpanded(true);
                window.dispatchEvent(new CustomEvent(API_KEY_UPDATED_EVENT));
              }}
              className="w-full py-2 rounded-md text-sm font-semibold border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              저장된 API 키 삭제
            </button>
          )}
        </div>

        {/* General Settings */}
        <div className="bg-white dark:bg-[#221E1B] rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-[#78716C] dark:text-[#9C8F87]" />
            <h3 className="text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">기본 정보</h3>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-md px-3 py-2 text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
            💡 소속기관은 필요한 공문서 맥락에만 참고되고, 이름·담당 학년/반·학생 명단은 수업자료와 학생기록에서 활용됩니다.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>이름</label>
              <input type="text" className={inputClass} placeholder="예: 홍길동" value={teacherName} onChange={e => setTeacherName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>소속기관</label>
              <input type="text" className={inputClass} placeholder="예: 충북교육청" value={institution} onChange={e => setInstitution(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>기본 학교급</label>
            <div className="flex gap-2">
              {[SchoolLevel.ELEMENTARY, SchoolLevel.MIDDLE, SchoolLevel.HIGH].map(level => (
                <button
                  key={level}
                  onClick={() => setSchoolLevel(level)}
                  className={`flex-1 py-2 text-sm rounded-md border font-medium transition-all ${
                    schoolLevel === level
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-[#1E88E5] text-[#1E88E5]'
                      : 'bg-white dark:bg-[#221E1B] border-[#E7E5E4] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>담당 학년/반</label>
            <input type="text" className={inputClass} placeholder="예: 5학년 2반" value={gradeClass} onChange={e => setGradeClass(e.target.value)} />
          </div>

          <button
            onClick={handleSaveSettings}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold bg-[#1E88E5] text-white hover:bg-[#1565C0]"
          >
            <Save className="w-4 h-4" />
            {saved ? '저장됨!' : '설정 저장'}
          </button>
        </div>

        {/* Student Roster */}
        <div className="bg-white dark:bg-[#221E1B] rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-[#78716C] dark:text-[#9C8F87]" />
            <h3 className="text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">우리반 학생 명단</h3>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-md px-3 py-2 text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
            💡 학생 명단을 입력하면 <strong>수업자료·오늘의 주인공</strong> 등에서 "우리반 자동 입력" 버튼으로 바로 불러올 수 있습니다.
          </div>

          {/* 번호+이름 통합 명단 */}
          <div>
            <label className={labelClass}>번호 + 이름 통합 명단</label>
            <p className="text-xs text-[#A8A29E] mb-1.5">
              한 줄에 한 명씩 입력. 앞에 번호를 붙이면 수업자료에 번호가 반영됩니다.
            </p>
            <textarea
              className={`${inputClass} min-h-[100px] resize-y font-mono text-xs`}
              placeholder={"1. 김○수\n2. 이○영\n3. 박○호\n4. 최○민"}
              value={studentNames}
              onChange={e => setStudentNames(e.target.value)}
              onPaste={handleStudentNamesPaste}
            />
          </div>

          {/* 성별 구분 명단 */}
          <div>
            <label className={labelClass}>성별 구분 명단 <span className="text-xs font-normal text-[#A8A29E]">(오늘의 주인공 남/녀 모드용)</span></label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">남학생</span>
                </div>
                <textarea
                  className={`${inputClass} min-h-[90px] resize-y font-mono text-xs`}
                  placeholder={"김○수\n박○호\n이○민"}
                  value={studentMaleNames}
                  onChange={e => setStudentMaleNames(e.target.value)}
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded">여학생</span>
                </div>
                <textarea
                  className={`${inputClass} min-h-[90px] resize-y font-mono text-xs`}
                  placeholder={"이○영\n최○아\n정○린"}
                  value={studentFemaleNames}
                  onChange={e => setStudentFemaleNames(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            onClick={async () => {
              await window.electronAPI.setConfig({
                teacherName,
                institution,
                schoolLevel,
                gradeClass,
                studentNames,
                studentMaleNames,
                studentFemaleNames,
              });
              setSaved(true);
              setTimeout(() => setSaved(false), 2500);
            }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold border border-[#E7E5E4] text-[#44403C] hover:bg-[#FAF9F7]"
          >
            <Save className="w-4 h-4" />
            학생 명단 저장
          </button>
        </div>

        {/* App Data Folder */}
        <div className="bg-white dark:bg-[#221E1B] rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Folder className="w-4 h-4 text-[#78716C] dark:text-[#9C8F87]" />
            <h3 className="text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">앱 데이터 저장 폴더</h3>
          </div>
          <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">
            나만의 자료실, 학생 메모처럼 앱 안에서 계속 불러올 데이터가 이 폴더의 JSON 파일로 저장됩니다.
          </p>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              readOnly
              value={appDataDir || '기본 앱 데이터 폴더'}
              className="flex-1 bg-[#FAF9F7] dark:bg-[#2E2822] rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-[#78716C] dark:text-[#C4B8B0] text-sm p-2.5 cursor-not-allowed"
            />
            <button
              onClick={handleSelectAppDataFolder}
              className="px-4 py-2.5 text-sm font-bold border border-[#E7E5E4] dark:border-[#2E2822] rounded-md text-[#44403C] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420] whitespace-nowrap"
            >
              폴더 선택
            </button>
          </div>
        </div>

        {/* Safety Options */}
        <div className="bg-white dark:bg-[#221E1B] rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">생성 안전 옵션</h3>
          </div>
          <label className="flex items-start gap-3 p-3 rounded-md border border-[#EDE8E1] dark:border-[#2E2822] bg-[#FAF9F7] dark:bg-[#171210] cursor-pointer">
            <input
              type="checkbox"
              checked={privacyModeEnabled}
              onChange={e => setPrivacyModeEnabled(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">개인정보 보호 모드</span>
              <span className="block text-xs text-[#78716C] dark:text-[#9C8F87] mt-0.5">학생 이름을 임시 토큰으로 바꿔 AI 요청을 보낸 뒤 결과에서 원래 이름으로 복원합니다.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-md border border-[#EDE8E1] dark:border-[#2E2822] bg-[#FAF9F7] dark:bg-[#171210] cursor-pointer">
            <input
              type="checkbox"
              checked={reviewChecklistEnabled}
              onChange={e => setReviewChecklistEnabled(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">생성 결과 검토 체크리스트</span>
              <span className="block text-xs text-[#78716C] dark:text-[#9C8F87] mt-0.5">생성 결과 화면에서 개인정보, 과장 표현, 최신 지침 확인 항목을 함께 표시합니다.</span>
            </span>
          </label>
          <div>
            <label className={labelClass}>사용자 주의어/금지 표현</label>
            <textarea
              className={`${inputClass} min-h-[90px] resize-y`}
              placeholder={"성실함\n우수함\n대회\n수상"}
              value={cautionTerms}
              onChange={e => setCautionTerms(e.target.value)}
            />
            <p className="text-xs text-[#78716C] dark:text-[#9C8F87] mt-1">
              한 줄에 하나씩 입력하면 생성 결과 화면에서 포함 여부를 알려줍니다.
            </p>
          </div>
          <div>
            <label className={labelClass}>생기부 항목별 바이트 제한</label>
            <div className="grid grid-cols-2 gap-2">
              {RECORD_KINDS.map(kind => (
                <div key={kind} className="flex items-center gap-2">
                  <span className="text-xs text-[#78716C] dark:text-[#9C8F87] w-20 shrink-0">{BYTE_LIMIT_LABELS[kind]}</span>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={byteLimits[kind]}
                    onChange={e => {
                      const next = Number(e.target.value);
                      setByteLimits(prev => ({ ...prev, [kind]: Number.isFinite(next) ? next : prev[kind] }));
                    }}
                    className={`${inputClass} py-1.5`}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-[#78716C] dark:text-[#9C8F87] mt-1">
              생성 결과의 바이트 수가 이 값을 넘으면 결과 화면에 붉게 표시합니다. 기재요령은 학년도·학교급에 따라 다르니 우리 학교 기준으로 맞춰 주세요.
            </p>
          </div>
          <button
            onClick={async () => {
              // 입력 중 잠시 비어 있거나 범위를 벗어난 값은 저장하지 않고 기본값으로 되돌린다.
              const safeLimits = Object.fromEntries(
                RECORD_KINDS.map(kind => [kind, isValidByteLimit(byteLimits[kind]) ? byteLimits[kind] : DEFAULT_BYTE_LIMITS[kind]]),
              ) as Record<RecordKind, number>;
              setByteLimits(safeLimits);
              await window.electronAPI.setConfig({ privacyModeEnabled, reviewChecklistEnabled, cautionTerms, neisByteLimits: JSON.stringify(safeLimits) });
              setSaved(true);
              setTimeout(() => setSaved(false), 2500);
            }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold border border-[#E7E5E4] dark:border-[#2E2822] text-[#44403C] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]"
          >
            <Save className="w-4 h-4" />
            안전 옵션 저장
          </button>
        </div>

        {/* Backup */}
        <div className="bg-white dark:bg-[#221E1B] rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Folder className="w-4 h-4 text-[#78716C] dark:text-[#9C8F87]" />
            <h3 className="text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">전체 자료 백업</h3>
          </div>
          <p className="text-xs text-[#78716C] dark:text-[#9C8F87] leading-relaxed">
            기본 정보, 학생 명단, 나만의 자료실, 학생 메모 등 앱 자료를 하나의 JSON 파일로 저장하고 다른 컴퓨터에서 불러올 수 있습니다. API 키는 보안상 포함하지 않습니다.
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md p-2.5">
            ⚠️ 백업 파일에는 학생 실명·상담 기록·생성 이력이 암호화 없이 그대로 들어갑니다. USB나 클라우드에 보관할 때는 유출되지 않도록 주의해 주세요.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportBackup}
              className="flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold bg-[#1C1917] dark:bg-[#2E2822] text-white dark:text-[#F0EBE6] hover:bg-[#0F0D0B] dark:hover:bg-[#3A332D]"
            >
              <Download className="w-4 h-4" />
              전체 자료 백업
            </button>
            <button
              onClick={handleImportBackup}
              className="flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold border border-[#E7E5E4] dark:border-[#2E2822] text-[#44403C] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]"
            >
              <Upload className="w-4 h-4" />
              백업 불러오기
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#EDE8E1] dark:border-[#2E2822]">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">자동 정기 백업</p>
              <p className="text-xs text-[#78716C] dark:text-[#9C8F87] leading-relaxed">
                앱을 시작할 때 설정한 주기가 지났으면 앱 데이터 폴더의 backups에 자동으로 저장합니다 (최근 10개 보관). 학생 정보가 암호화 없이 저장되니, 필요하지 않다면 "사용 안 함"으로 두세요.
              </p>
            </div>
            <select
              value={autoBackupInterval}
              onChange={async e => {
                const next = e.target.value as 'off' | 'daily' | 'weekly';
                setAutoBackupInterval(next);
                await window.electronAPI.setConfig({ autoBackupInterval: next });
              }}
              className="shrink-0 bg-white dark:bg-[#171210] border border-[#E7E5E4] dark:border-[#2E2822] rounded-md text-sm text-[#1C1917] dark:text-[#F0EBE6] p-2 outline-none"
            >
              <option value="weekly">매주</option>
              <option value="daily">매일</option>
              <option value="off">사용 안 함</option>
            </select>
          </div>
          {backupStatus && <p className="text-xs text-blue-600 dark:text-blue-400">{backupStatus}</p>}
        </div>

        {/* Save Folder */}
        <div className="bg-white dark:bg-[#221E1B] rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Folder className="w-4 h-4 text-[#78716C] dark:text-[#9C8F87]" />
            <h3 className="text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">파일 저장 폴더</h3>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              readOnly
              value={saveDir || '기본 다운로드 폴더'}
              className="flex-1 bg-[#FAF9F7] dark:bg-[#1C1917] rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] text-sm p-2.5 cursor-not-allowed"
            />
            <button
              onClick={handleSelectFolder}
              className="px-4 py-2.5 text-sm font-bold border border-[#E7E5E4] dark:border-[#2E2822] rounded-md text-[#44403C] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2521] whitespace-nowrap"
            >
              폴더 선택
            </button>
          </div>
          <p className="text-xs text-[#A8A29E] dark:text-[#7C7268]">파일 저장 시 기본으로 사용될 폴더입니다.</p>
        </div>

        {/* Danger Zone: Clear Student Data */}
        <div className="bg-white dark:bg-[#221E1B] rounded-lg border border-red-200 dark:border-red-900/60 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Trash2 className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold text-red-700 dark:text-red-300">학생 데이터 전체 삭제</h3>
          </div>
          <p className="text-xs text-[#78716C] dark:text-[#9C8F87] leading-relaxed">
            학생별 생성 이력, 문서 생성 이력, 학생 메모, 설정에 저장된 학생 명단을 한 번에 삭제합니다.
            학년이 끝나 학생 정보를 정리할 때 사용하세요. 되돌릴 수 없으니 필요하면 먼저 백업해 주세요.
          </p>
          <button
            onClick={handleClearStudentData}
            disabled={isClearingStudentData}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            {isClearingStudentData ? '삭제 중...' : '학생 데이터 전체 삭제'}
          </button>
        </div>

        {/* Version */}
        <div className="text-center text-xs text-[#A8A29E] pb-4">
          EduNote — Developed by Dustin
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;
