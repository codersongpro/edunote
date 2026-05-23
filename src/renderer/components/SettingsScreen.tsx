import React, { useState, useEffect } from 'react';
import { Settings, Key, Save, CheckCircle, AlertCircle, AlertTriangle, ExternalLink, ChevronDown, ChevronUp, Folder, User, School, Users } from 'lucide-react';
import { SchoolLevel } from '../types';

const SettingsScreen: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
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
    await window.electronAPI.setApiKey(apiKey.trim());
    setHasKey(true);
    setApiKey('');
    setTestStatus('idle');
    setGuideExpanded(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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
                    <span>생성된 키 <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">AIza...</span> 복사 → 아래 입력란에 붙여넣기</span>
                  </li>
                </ol>
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

          <div>
            <label className={labelClass}>새 API 키 {!hasKey && <span className="text-red-500">*</span>}</label>
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
            <div className="flex items-start gap-2 text-amber-700 bg-amber-50 p-2.5 rounded-md border border-amber-200 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{testWarn}</span>
            </div>
          )}
          {testStatus === 'fail' && (
            <div className="flex items-start gap-2 text-red-600 bg-red-50 p-2.5 rounded-md border border-red-100 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{testError}</span>
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
              disabled={!apiKey.trim()}
              className="flex-1 py-2.5 rounded-md text-sm font-bold bg-[#1E88E5] text-white hover:bg-[#1565C0] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saved ? '저장됨!' : 'API 키 저장'}
            </button>
          </div>
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
