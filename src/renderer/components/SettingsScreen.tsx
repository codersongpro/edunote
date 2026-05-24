import React, { useState, useEffect, useRef } from 'react';
import { Settings, Key, Save, CheckCircle, AlertCircle, AlertTriangle, ExternalLink, ChevronDown, ChevronUp, Folder, User, School, Users, RefreshCw } from 'lucide-react';
import { SchoolLevel } from '../types';
import { useGlobalState } from '../GlobalStateContext';
import { playSuccessSound } from '../lib/soundEffect';

const SettingsScreen: React.FC = () => {
  const { showToast, setApiKeyActivated } = useGlobalState();
  const [apiKey, setApiKey] = useState('');

  // API 키 활성화 자동 감지를 위한 폴링 상태
  // 새 GCP 프로젝트의 키는 발급 직후 1~2분간 활성화 중일 수 있으므로,
  // 백그라운드에서 점진적 백오프 폴링을 수행하여 첫 성공 시점에 토스트로 알림
  const [activationPolling, setActivationPolling] = useState(false);
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingCancelRef = useRef<boolean>(false);

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      pollingCancelRef.current = true;
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
    };
  }, []);

  // 점진적 백오프 폴링: 10초 → 20초 → 40초 → 60초 → 60초... (최대 5분)
  // 첫 성공(쿼터 경고 포함) 시 토스트로 알림 후 종료
  const startActivationPolling = () => {
    pollingCancelRef.current = false;
    setActivationPolling(true);

    const delays = [10_000, 20_000, 40_000, 60_000, 60_000, 60_000]; // 합계 약 5분
    let attempt = 0;

    const poll = async () => {
      if (pollingCancelRef.current) { setActivationPolling(false); return; }

      try {
        // 저장된 키로 빈 프롬프트 호출 — 키가 활성화됐는지만 확인
        const hasKeyNow = await window.electronAPI.hasApiKey();
        if (!hasKeyNow) { setActivationPolling(false); return; }

        // testApiKey를 사용하기 위해 저장된 키를 알아야 하는데, 보안상 키 조회 불가.
        // 대신 ai:generate를 짧은 프롬프트로 호출하여 성공 여부만 판단
        await window.electronAPI.aiGenerate('Hi', undefined);
        // 성공!
        if (!pollingCancelRef.current) {
          setApiKeyActivated(true);
          playSuccessSound();
          showToast({
            type: 'success',
            title: 'API 키 활성화 완료!',
            description: 'Gemini AI를 이제 사용할 수 있습니다.',
          });
        }
        setActivationPolling(false);
        return;
      } catch (e) {
        // 아직 활성화 안 됨 → 다음 시도 예약
        attempt++;
        if (attempt >= delays.length || pollingCancelRef.current) {
          // 5분 경과 — 폴링 중단 (사용자가 수동 테스트하면 됨)
          setActivationPolling(false);
          return;
        }
        pollingTimerRef.current = setTimeout(poll, delays[attempt]);
      }
    };

    // 첫 시도는 즉시 후 10초 후 재시도
    pollingTimerRef.current = setTimeout(poll, delays[0]);
  };

  // 즉시 활성화 확인 (사용자가 "지금 확인" 클릭 시)
  const checkActivationNow = async () => {
    try {
      await window.electronAPI.aiGenerate('Hi', undefined);
      setApiKeyActivated(true);
      playSuccessSound();
      showToast({
        type: 'success',
        title: 'API 키 활성화 완료!',
        description: 'Gemini AI를 이제 사용할 수 있습니다.',
      });
      // 폴링 중단
      pollingCancelRef.current = true;
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
      setActivationPolling(false);
    } catch (e: any) {
      showToast({
        type: 'warning',
        title: '아직 활성화 중입니다',
        description: '1~2분 더 기다린 후 다시 확인해 주세요.',
      });
    }
  };
  const [teacherName, setTeacherName] = useState('');
  const [institution, setInstitution] = useState('');
  const [schoolLevel, setSchoolLevel] = useState<string>(SchoolLevel.HIGH);
  const [gradeClass, setGradeClass] = useState('');
  const [studentNames, setStudentNames] = useState('');
  const [studentMaleNames, setStudentMaleNames] = useState('');
  const [studentFemaleNames, setStudentFemaleNames] = useState('');
  const [saveDir, setSaveDir] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'warn' | 'fail'>('idle');
  const [testError, setTestError] = useState('');
  const [testWarn, setTestWarn] = useState('');
  const [saved, setSaved] = useState(false);
  const [guideExpanded, setGuideExpanded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [hn, tn, inst, sl, gc, stNames, stMale, stFemale, sd] = await Promise.all([
        window.electronAPI.hasApiKey(),
        window.electronAPI.getConfig('teacherName'),
        window.electronAPI.getConfig('institution'),
        window.electronAPI.getConfig('schoolLevel'),
        window.electronAPI.getConfig('gradeClass'),
        window.electronAPI.getConfig('studentNames'),
        window.electronAPI.getConfig('studentMaleNames'),
        window.electronAPI.getConfig('studentFemaleNames'),
        window.electronAPI.getConfig('saveDir'),
      ]);
      setHasKey(hn as boolean);
      setTeacherName(tn as string || '');
      setInstitution(inst as string || '');
      setSchoolLevel((sl as string) || SchoolLevel.HIGH);
      setGradeClass(gc as string || '');
      setStudentNames(stNames as string || '');
      setStudentMaleNames(stMale as string || '');
      setStudentFemaleNames(stFemale as string || '');
      setSaveDir(sd as string || '');
      setGuideExpanded(!(hn as boolean));
    };
    load();
  }, []);

  const handleTestKey = async () => {
    if (!apiKey.trim()) return;
    setTestStatus('testing');
    setTestError('');
    setTestWarn('');
    try {
      const result = await window.electronAPI.testApiKey(apiKey.trim()) as { ok: boolean; warning?: string; error?: string };
      if (result?.ok) {
        if (result.warning) {
          setTestStatus('warn');
          setTestWarn(result.warning);
        } else {
          setTestStatus('ok');
        }
      } else {
        setTestStatus('fail');
        setTestError(result?.error || 'API 키가 유효하지 않습니다.');
      }
    } catch (e) {
      setTestStatus('fail');
      setTestError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    }
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;

    // 아직 테스트 통과 상태가 아니면 자동으로 테스트 먼저 실행
    if (testStatus !== 'ok' && testStatus !== 'warn') {
      setTestStatus('testing');
      setTestError('');
      setTestWarn('');
      try {
        const result = await window.electronAPI.testApiKey(apiKey.trim()) as { ok: boolean; warning?: string; error?: string };
        if (!result?.ok) {
          setTestStatus('fail');
          setTestError(result?.error || 'API 키가 유효하지 않습니다.');
          return; // 저장 차단
        }
        if (result.warning) {
          setTestStatus('warn');
          setTestWarn(result.warning);
        } else {
          setTestStatus('ok');
        }
      } catch (e) {
        setTestStatus('fail');
        setTestError(e instanceof Error ? e.message : '오류가 발생했습니다.');
        return; // 저장 차단
      }
    }

    await window.electronAPI.setApiKey(apiKey.trim());
    setHasKey(true);
    setApiKey('');
    setTestStatus('idle');
    setGuideExpanded(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);

    // 즉시 사용 가능한지 한 번 확인 후, 아직 활성화 중이면 백그라운드 폴링 시작
    try {
      await window.electronAPI.aiGenerate('Hi', undefined);
      // 즉시 사용 가능
      setApiKeyActivated(true);
      playSuccessSound();
      showToast({
        type: 'success',
        title: 'API 키가 즉시 활성화됐습니다',
        description: '바로 사용 가능합니다.',
      });
    } catch {
      // 아직 활성화 중 → 백그라운드 폴링 시작 + 안내 토스트
      showToast({
        type: 'info',
        title: 'API 키 활성화 대기 중...',
        description: '백그라운드에서 자동 확인 중입니다. 완료되면 알려드릴게요.',
      });
      startActivationPolling();
    }
  };

  const handleSaveSettings = async () => {
    await window.electronAPI.setConfig({ teacherName, institution, schoolLevel, gradeClass, studentNames });
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

  const handleOpenAiStudio = () => {
    window.electronAPI.openExternal('https://aistudio.google.com');
  };

  const inputClass = 'w-full bg-white rounded-md border border-gray-300 text-gray-800 text-sm focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] outline-none p-2.5 transition-all';
  const labelClass = 'block text-sm font-bold text-gray-700 mb-1.5';

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA] overflow-y-auto">
      <div className="max-w-xl mx-auto w-full p-4 space-y-4">

        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-gray-100 p-1.5 rounded-lg">
              <Settings className="w-4 h-4 text-gray-600" />
            </div>
            <h2 className="font-bold text-gray-800">EduNote 설정</h2>
          </div>
          <p className="text-xs text-gray-500">Gemini API 키와 기본 정보를 설정합니다.</p>
        </div>

        {/* API Key Guide */}
        <div className={`rounded-lg border shadow-sm ${!hasKey ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}>
          <button
            onClick={() => setGuideExpanded(!guideExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className={`w-4 h-4 ${!hasKey ? 'text-blue-600' : 'text-gray-500'}`} />
              <span className={`text-sm font-bold ${!hasKey ? 'text-blue-800' : 'text-gray-700'}`}>
                Gemini API 키 무료 발급 방법
              </span>
              {!hasKey && <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-medium">필수</span>}
            </div>
            {guideExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {guideExpanded && (
            <div className="px-4 pb-4">
              <div className="bg-white rounded-md border border-blue-100 p-4 space-y-3">
                <ol className="space-y-2.5 text-sm text-gray-700">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-[#1E88E5] text-white text-xs rounded-full flex items-center justify-center font-bold">1</span>
                    <span>크롬 브라우저에서{' '}
                      <button
                        onClick={handleOpenAiStudio}
                        className="text-blue-600 hover:underline font-medium inline-flex items-center gap-0.5"
                      >
                        aistudio.google.com <ExternalLink className="w-3 h-3" />
                      </button>{' '}
                      접속
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-[#1E88E5] text-white text-xs rounded-full flex items-center justify-center font-bold">2</span>
                    <span>구글 계정으로 로그인 <span className="text-gray-500">(무료 Google 계정으로 충분)</span></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-[#1E88E5] text-white text-xs rounded-full flex items-center justify-center font-bold">3</span>
                    <span>좌측 메뉴에서 <strong>"API 키"</strong> 클릭 <span className="text-gray-500">(영문 메뉴인 경우 "Get API key")</span></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-[#1E88E5] text-white text-xs rounded-full flex items-center justify-center font-bold">4</span>
                    <span>우측 상단 <strong>"API 키 만들기"</strong> 버튼 클릭 → 키 생성 <span className="text-gray-500">(영문: "Create API key")</span></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-[#1E88E5] text-white text-xs rounded-full flex items-center justify-center font-bold">5</span>
                    <span>키 생성 시 프로젝트 선택 화면이 나오면 <strong>"새 프로젝트에서 API 키 만들기"</strong>를 선택 <span className="text-gray-500">(기존 GCP 프로젝트는 결제 계정이 연결되어 있을 수 있음)</span></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-[#1E88E5] text-white text-xs rounded-full flex items-center justify-center font-bold">6</span>
                    <span>생성된 키 <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">AIza...</span> 복사 → 아래 입력란에 붙여넣기</span>
                  </li>
                </ol>

                {/* 무료 등급 확인 강조 박스 — 결제 등급이 잘못되면 과금 우려가 있어 별도 안내 */}
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md p-3">
                  <p className="text-xs font-bold text-amber-800 mb-1.5 flex items-center gap-1">
                    💰 발급 후 반드시 "무료 등급"인지 확인하세요
                  </p>
                  <ol className="text-xs text-amber-700 space-y-1 leading-relaxed pl-4 list-decimal">
                    <li>aistudio.google.com → 좌측 메뉴 <strong>"API 키"</strong> 목록 화면 열기</li>
                    <li>방금 만든 키의 <strong>"결제 설정"</strong> 컬럼 확인</li>
                    <li><span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-bold">무료 등급</span>이면 OK — 분당 15회 / 일 1500회까지 무료</li>
                    <li><span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold">유료 등급</span>이면 사용량 따라 과금 → 결제 계정 미연결된 새 프로젝트에서 키를 다시 발급</li>
                  </ol>
                  <p className="text-[11px] text-amber-600 mt-2">
                    팁: 신규 Gmail 계정으로 처음 발급하면 자동으로 무료 등급이 됩니다.
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    참고: 무료 계정 기준 분당 15회 요청 제한 — 일반 사용에 충분합니다.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* API Key Input */}
        <div className={`rounded-lg border shadow-sm p-4 space-y-3 transition-all ${!hasKey ? 'bg-amber-50 border-amber-400 animate-pulse' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Key className={`w-4 h-4 ${!hasKey ? 'text-amber-600' : 'text-gray-500'}`} />
            <h3 className={`text-sm font-bold ${!hasKey ? 'text-amber-800' : 'text-gray-700'}`}>API 키 설정</h3>
            {!hasKey && (
              <span className="flex items-center gap-1 text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                ⚠ 미입력
              </span>
            )}
            {hasKey && (
              <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                <CheckCircle className="w-3 h-3" />
                등록됨
              </span>
            )}
          </div>

          {hasKey && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2.5 rounded-md border border-green-100">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>API 키가 안전하게 저장되어 있습니다. 변경하려면 새 키를 입력하세요.</span>
            </div>
          )}

          {/* 키 활성화 자동 폴링 중 안내 — 사용자가 수동으로도 확인 가능 */}
          {activationPolling && (
            <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 p-3 rounded-md border border-blue-200">
              <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />
              <div className="flex-1">
                <p className="font-bold">API 키 활성화 확인 중...</p>
                <p className="text-xs mt-0.5 text-blue-600">
                  새 키는 1~2분간 활성화 대기 시간이 있을 수 있습니다. 완료되면 알림으로 알려드립니다.
                </p>
                <button
                  onClick={checkActivationNow}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold bg-blue-100 text-blue-700 border border-blue-300 rounded px-2.5 py-1 hover:bg-blue-200"
                >
                  <RefreshCw className="w-3 h-3" />
                  지금 확인
                </button>
              </div>
            </div>
          )}

          <div>
            <label className={`${labelClass} flex items-center gap-2`}>
              <span>새 API 키 {!hasKey && <span className="text-red-500">*</span>}</span>
              {hasKey && (
                <span className="flex items-center gap-1 text-xs font-bold bg-green-100 text-green-700 border border-green-300 rounded-full px-2 py-0.5">
                  <CheckCircle className="w-3 h-3" />
                  API 키 설정 완료
                </span>
              )}
            </label>
            <input
              type="password"
              className={inputClass}
              placeholder={hasKey ? '새 키를 입력하면 기존 키가 교체됩니다' : 'AIza로 시작하는 API 키를 붙여넣으세요'}
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setTestStatus('idle'); }}
            />
          </div>

          {testStatus === 'ok' && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 p-2.5 rounded-md border border-green-100 text-sm">
              <CheckCircle className="w-4 h-4" />
              API 키가 정상적으로 확인되었습니다.
            </div>
          )}
          {testStatus === 'warn' && (
            <div className="flex items-start gap-2 text-green-700 bg-green-50 p-2.5 rounded-md border border-green-100 text-sm">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">API 키 정상 — 바로 사용 가능합니다!</p>
                <p className="text-xs mt-0.5 text-green-600">{testWarn}</p>
              </div>
            </div>
          )}
          {testStatus === 'fail' && (
            <div className="flex items-start gap-2 text-red-600 bg-red-50 p-2.5 rounded-md border border-red-100 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="whitespace-pre-line">{testError}</span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleTestKey}
              disabled={!apiKey.trim() || testStatus === 'testing'}
              className="flex-1 py-2.5 rounded-md text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {testStatus === 'testing' ? '테스트 중...' : '키 테스트'}
            </button>
            <button
              onClick={handleSaveKey}
              disabled={!apiKey.trim() || testStatus === 'testing'}
              className="flex-1 py-2.5 rounded-md text-sm font-bold bg-[#1E88E5] text-white hover:bg-[#1565C0] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {testStatus === 'testing' ? '확인 중...' : saved ? '저장 완료!' : 'API 키 저장'}
            </button>
          </div>
          {hasKey && (
            <button
              onClick={async () => {
                if (!window.confirm('저장된 API 키를 삭제하시겠습니까?')) return;
                await window.electronAPI.deleteApiKey();
                setHasKey(false);
                setApiKey('');
                setTestStatus('idle');
                setGuideExpanded(true);
              }}
              className="w-full py-2 rounded-md text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
            >
              저장된 API 키 삭제
            </button>
          )}
        </div>

        {/* General Settings */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-bold text-gray-700">기본 정보</h3>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-md px-3 py-2 text-xs text-blue-700 leading-relaxed">
            💡 이름, 소속기관, 담당 학년/반을 입력하면 <strong>공문서·수업자료·학생기록 생성 결과물</strong>에 자동으로 반영됩니다.
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
                      ? 'bg-blue-50 border-[#1E88E5] text-[#1E88E5]'
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
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
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-bold text-gray-700">우리반 학생 명단</h3>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-md px-3 py-2 text-xs text-blue-700 leading-relaxed">
            💡 학생 명단을 입력하면 <strong>수업자료·럭키드로우</strong> 등에서 "우리반 자동 입력" 버튼으로 바로 불러올 수 있습니다.
          </div>

          {/* 번호+이름 통합 명단 */}
          <div>
            <label className={labelClass}>번호 + 이름 통합 명단</label>
            <p className="text-xs text-gray-400 mb-1.5">
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
            <label className={labelClass}>성별 구분 명단 <span className="text-xs font-normal text-gray-400">(럭키드로우 남/녀 모드용)</span></label>
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
              await window.electronAPI.setConfig({ studentNames, studentMaleNames, studentFemaleNames });
              setSaved(true);
              setTimeout(() => setSaved(false), 2500);
            }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <Save className="w-4 h-4" />
            학생 명단 저장
          </button>
        </div>

        {/* Save Folder */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Folder className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-bold text-gray-700">파일 저장 폴더</h3>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              readOnly
              value={saveDir || '기본 다운로드 폴더'}
              className="flex-1 bg-gray-50 rounded-md border border-gray-200 text-gray-600 text-sm p-2.5 cursor-not-allowed"
            />
            <button
              onClick={handleSelectFolder}
              className="px-4 py-2.5 text-sm font-bold border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 whitespace-nowrap"
            >
              폴더 선택
            </button>
          </div>
          <p className="text-xs text-gray-400">파일 저장 시 기본으로 사용될 폴더입니다.</p>
        </div>

        {/* Version */}
        <div className="text-center text-xs text-gray-400 pb-4">
          EduNote — Developed by 송동석
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;
