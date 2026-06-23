import React, { useEffect, useState } from 'react';
import { Settings, BookOpen, Download, ChevronRight, ClipboardList, AlertTriangle, Info, CheckCircle, MessageCircle, GraduationCap, Presentation, FileText } from 'lucide-react';
import iconPng from '../assets/icon.png';
import { API_KEY_UPDATED_EVENT } from '../lib/apiKeyGuide';

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  releaseUrl: string;
}

type QuickStartKey = 'chat' | 'record' | 'lesson' | 'docAnalyze' | 'schoolDoc';

interface Props {
  onNavigate: (target: 'settings' | 'student' | 'admin' | 'guide') => void;
  onQuickStart: (key: QuickStartKey) => void;
  darkMode: boolean;
}

const QUICK_TILES: { key: QuickStartKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'chat', label: '채팅방', icon: MessageCircle },
  { key: 'record', label: '생기부', icon: GraduationCap },
  { key: 'lesson', label: '수업자료', icon: Presentation },
  { key: 'docAnalyze', label: '공문요약', icon: ClipboardList },
  { key: 'schoolDoc', label: '문서작성', icon: FileText },
];

const HomeScreen: React.FC<Props> = ({ onNavigate, onQuickStart }) => {
  const [version, setVersion] = useState('1.0.0');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [storageInfo, setStorageInfo] = useState({ appDataDir: '', saveDir: '', lastBackupAt: '' });
  const [hasUserInfo, setHasUserInfo] = useState(false);
  const [hasStudentInfo, setHasStudentInfo] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStatus, setBackupStatus] = useState('');
  const [infoLoaded, setInfoLoaded] = useState(false);

  useEffect(() => {
    const refreshApiKeyState = () => {
      window.electronAPI.hasApiKey().then((k: boolean) => setHasKey(k)).catch(() => setHasKey(false));
    };

    window.electronAPI.getVersion().then((v: string) => setVersion(v)).catch(() => {});
    window.electronAPI.checkUpdate().then((info: UpdateInfo) => setUpdateInfo(info)).catch(() => {});
    refreshApiKeyState();
    Promise.all([
      window.electronAPI.getConfig('appDataDir'),
      window.electronAPI.getConfig('saveDir'),
      window.electronAPI.getConfig('lastBackupAt'),
      window.electronAPI.getConfig('teacherName'),
      window.electronAPI.getConfig('studentNames'),
    ]).then(([appDataDir, saveDir, lastBackupAt, teacherName, studentNames]) => {
      setStorageInfo({
        appDataDir: String(appDataDir || ''),
        saveDir: String(saveDir || ''),
        lastBackupAt: String(lastBackupAt || ''),
      });
      setHasUserInfo(!!String(teacherName || '').trim());
      setHasStudentInfo(!!String(studentNames || '').trim());
      setInfoLoaded(true);
    }).catch(() => {});
    const handleBackupDone = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setStorageInfo(prev => ({ ...prev, lastBackupAt: detail.lastBackupAt }));
    };
    window.addEventListener('edunote:backup-done', handleBackupDone);
    window.addEventListener(API_KEY_UPDATED_EVENT, refreshApiKeyState);
    return () => {
      window.removeEventListener('edunote:backup-done', handleBackupDone);
      window.removeEventListener(API_KEY_UPDATED_EVENT, refreshApiKeyState);
    };
  }, []);

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
    setBackupStatus('');
    setIsBackingUp(true);
    try {
      const savedPath = await window.electronAPI.exportBackup(collectLocalStorage());
      if (savedPath) {
        const backupTime = new Date().toISOString();
        await window.electronAPI.setConfig({ lastBackupAt: backupTime });
        setStorageInfo(prev => ({ ...prev, lastBackupAt: backupTime }));
        window.dispatchEvent(new CustomEvent('edunote:backup-done', { detail: { lastBackupAt: backupTime } }));
        setBackupStatus('자료 백업 완료');
      }
    } catch (error) {
      setBackupStatus(error instanceof Error ? error.message : '백업 중 오류가 발생했습니다.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // 마지막 백업이 없거나 14일 이상 지났으면 백업을 권한다(데이터 분실 예방).
  const BACKUP_STALE_DAYS = 14;
  const lastBackupMs = storageInfo.lastBackupAt ? Date.parse(storageInfo.lastBackupAt) : 0;
  const isBackupStale = !lastBackupMs || (Date.now() - lastBackupMs) > BACKUP_STALE_DAYS * 24 * 60 * 60 * 1000;

  return (
    <div className="flex flex-col h-full bg-[#FAF9F7] dark:bg-[#171210] overflow-hidden">

      {/* 상단: 앱 상태 1행 4열 */}
      <div className="shrink-0 h-14 border-b border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] px-4 flex items-center">
        <div className="grid grid-cols-4 gap-3 text-xs w-full">
          {[
            {
              label: 'API 키',
              value: hasKey ? '등록됨' : '필요',
              icon: <CheckCircle className="w-3 h-3" />,
              color: hasKey ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400',
            },
            {
              label: '사용자 정보',
              value: hasUserInfo ? '입력됨' : '미입력',
              icon: <CheckCircle className="w-3 h-3" />,
              color: hasUserInfo ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400',
            },
            {
              label: '학생 정보',
              value: hasStudentInfo ? '입력됨' : '미입력',
              icon: <CheckCircle className="w-3 h-3" />,
              color: hasStudentInfo ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400',
            },
            {
              label: '마지막 백업',
              value: storageInfo.lastBackupAt
                ? new Date(storageInfo.lastBackupAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '기록 없음',
              icon: null,
              color: 'text-[#44403C] dark:text-[#C4B8B0]',
              action: handleExportBackup,
            },
          ].map(item => (
            <div key={item.label} className="flex min-w-0 items-center gap-2 py-1">
              <span className="text-[#A8A29E] dark:text-[#6B5E57] shrink-0">{item.label}</span>
              <span className={`min-w-0 flex-1 truncate font-bold flex items-center gap-0.5 ${item.color}`}>
                {item.icon}
                <span className="truncate">{item.value}</span>
              </span>
              {'action' in item && item.action && (
                <button
                  type="button"
                  onClick={item.action}
                  disabled={isBackingUp}
                  className="ml-auto shrink-0 whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                >
                  {isBackingUp ? '백업 중' : '자료 백업하기'}
                </button>
              )}
            </div>
          ))}
        </div>
        {backupStatus && <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">{backupStatus}</p>}
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 overflow-hidden">
        <div className="w-full max-w-lg flex flex-col gap-4">

          {/* 업데이트 알림 */}
          {updateInfo?.hasUpdate && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-500 shrink-0" />
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  새 버전 <strong>v{updateInfo.latestVersion}</strong>이 출시되었습니다.
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
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg shrink-0">
              <img src={iconPng} alt="EduNote" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-[#1C1917] dark:text-[#F0EBE6] tracking-tight">EduNote</h1>
                <span className="text-sm text-[#78716C] dark:text-[#9C8F87]">v{version}</span>
                {updateInfo && !updateInfo.hasUpdate && (
                  <span className="text-[11px] px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700 rounded-full font-semibold">
                    최신 버전
                  </span>
                )}
              </div>
              <p className="text-sm text-[#78716C] dark:text-[#9C8F87] mt-1">
                교무 행정 · 수업 준비 · 학생 기록을 AI가 도와드립니다.
              </p>
            </div>
          </div>

          {/* API 키 미설정 경고 */}
          {hasKey === false && (
            <div className="animate-pulse bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-500 rounded-xl p-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                  설정에서 무료 Gemini API 키를 입력해야 AI 기능을 사용할 수 있습니다.
                </p>
              </div>
            </div>
          )}

          {/* 백업 권장 안내 (백업이 없거나 오래된 경우) */}
          {infoLoaded && isBackupStale && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-sm text-emerald-800 dark:text-emerald-200">
                  {storageInfo.lastBackupAt
                    ? '마지막 백업이 2주 이상 지났습니다. 자료를 백업해 두세요.'
                    : '아직 백업한 적이 없습니다. 백업해 두면 PC 교체·재설치 시 안전합니다.'}
                </p>
              </div>
              <button
                onClick={handleExportBackup}
                disabled={isBackingUp}
                className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
              >
                {isBackingUp ? '백업 중' : '지금 백업'}
              </button>
            </div>
          )}

          {/* 주의 안내 */}
          <div className="bg-fuchsia-50 dark:bg-fuchsia-950/30 border-2 border-fuchsia-300 dark:border-fuchsia-700 rounded-xl p-3">
            <div className="flex gap-2 items-center">
              <Info className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-300 shrink-0" />
              <p className="text-sm text-fuchsia-900 dark:text-fuchsia-100">
                생성된 내용은 <strong className="font-black text-rose-600 dark:text-rose-300">반드시 검토·수정</strong>하여 활용해 주세요.
              </p>
            </div>
          </div>

          {/* 메뉴 바로가기 */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onNavigate('settings')}
              className={`group flex items-center gap-3 p-4 bg-white dark:bg-[#221E1B] rounded-xl border-2 transition-all text-left hover:shadow-md ${
                hasKey === false
                  ? 'border-amber-400 dark:border-amber-500 animate-pulse hover:border-amber-500'
                  : 'border-[#EDE8E1] dark:border-[#2E2822] hover:border-[#A8A29E] dark:hover:border-[#6B5E57]'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${hasKey === false ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-[#EDE8E1] dark:bg-[#2E2822]'}`}>
                <Settings className={`w-4 h-4 ${hasKey === false ? 'text-amber-600 dark:text-amber-400' : 'text-[#78716C] dark:text-[#9C8F87]'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#1C1917] dark:text-[#F0EBE6] text-sm">
                  설정{hasKey === false && <span className="ml-1 text-amber-500">키 미설정</span>}
                </p>
                <p className="text-xs text-[#78716C] dark:text-[#9C8F87] mt-0.5 truncate">API 키 · 교사/학생 정보</p>
              </div>
              <ChevronRight className={`w-4 h-4 shrink-0 group-hover:translate-x-1 transition-transform ${hasKey === false ? 'text-amber-400' : 'text-[#A8A29E]'}`} />
            </button>

            <button
              onClick={() => onNavigate('guide')}
              className="group flex items-center gap-3 p-4 bg-white dark:bg-[#221E1B] rounded-xl border border-[#EDE8E1] dark:border-[#2E2822] hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition-all text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#1C1917] dark:text-[#F0EBE6] text-sm">사용 방법</p>
                <p className="text-xs text-[#78716C] dark:text-[#9C8F87] mt-0.5 truncate">API 키 발급 · 기능 소개</p>
              </div>
              <ChevronRight className="w-4 h-4 text-purple-400 shrink-0 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* 빠른 시작 */}
          <div>
            <p className="text-xs font-bold text-[#A8A29E] dark:text-[#6B5E57] mb-1.5 px-0.5">빠른 시작</p>
            <div className="grid grid-cols-5 gap-2">
              {QUICK_TILES.map(t => (
                <button
                  key={t.key}
                  onClick={() => onQuickStart(t.key)}
                  className="flex flex-col items-center gap-1.5 p-2.5 bg-white dark:bg-[#221E1B] rounded-xl border border-[#EDE8E1] dark:border-[#2E2822] hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-sm transition-all"
                >
                  <t.icon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <span className="text-[11px] font-medium text-[#44403C] dark:text-[#C4B8B0] text-center leading-tight break-keep">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 앱 만족도 설문 */}
          <button
            onClick={() => window.electronAPI.openExternal('https://forms.gle/X7rRcFRnsGNSt1ZFA')}
            className="flex items-center justify-between gap-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl p-4 text-left transition-all shadow-sm hover:shadow-md"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <ClipboardList className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">앱 만족도 설문 참여하기</p>
                <p className="text-xs text-indigo-100 mt-0.5">소중한 의견이 더 나은 EduNote를 만듭니다</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/70 shrink-0" />
          </button>

        </div>
      </div>


    </div>
  );
};

export default HomeScreen;
