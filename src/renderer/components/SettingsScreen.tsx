import React, { useState, useEffect } from 'react';
import { Settings, Key, Save, CheckCircle, AlertCircle, ExternalLink, ChevronDown, ChevronUp, Folder, User, School } from 'lucide-react';
import { SchoolLevel } from '../types';

const SettingsScreen: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [schoolLevel, setSchoolLevel] = useState<string>(SchoolLevel.HIGH);
  const [saveDir, setSaveDir] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testError, setTestError] = useState('');
  const [saved, setSaved] = useState(false);
  const [guideExpanded, setGuideExpanded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [hn, tn, sn, sl, sd] = await Promise.all([
        window.electronAPI.hasApiKey(),
        window.electronAPI.getConfig('teacherName'),
        window.electronAPI.getConfig('schoolName'),
        window.electronAPI.getConfig('schoolLevel'),
        window.electronAPI.getConfig('saveDir'),
      ]);
      setHasKey(hn as boolean);
      setTeacherName(tn as string || '');
      setSchoolName(sn as string || '');
      setSchoolLevel((sl as string) || SchoolLevel.HIGH);
      setSaveDir(sd as string || '');
      setGuideExpanded(!(hn as boolean));
    };
    load();
  }, []);

  const handleTestKey = async () => {
    if (!apiKey.trim()) return;
    setTestStatus('testing');
    setTestError('');
    try {
      const ok = await window.electronAPI.testApiKey(apiKey.trim());
      setTestStatus(ok ? 'ok' : 'fail');
      if (!ok) setTestError('API 키가 유효하지 않습니다. 키를 확인하세요.');
    } catch (e) {
      setTestStatus('fail');
      setTestError(e instanceof Error ? e.message : 'API 키 테스트 중 오류가 발생했습니다.');
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
    await window.electronAPI.setConfig({ teacherName, schoolName, schoolLevel });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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
            <h2 className="font-bold text-gray-800">에듀노트 설정</h2>
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
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-bold text-gray-700">API 키 설정</h3>
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

          <div>
            <label className={labelClass}>교사 이름</label>
            <input type="text" className={inputClass} placeholder="예: 홍길동" value={teacherName} onChange={e => setTeacherName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>학교 이름</label>
            <input type="text" className={inputClass} placeholder="예: 충북초등학교" value={schoolName} onChange={e => setSchoolName(e.target.value)} />
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

          <button
            onClick={handleSaveSettings}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold bg-[#1E88E5] text-white hover:bg-[#1565C0]"
          >
            <Save className="w-4 h-4" />
            {saved ? '저장됨!' : '설정 저장'}
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
          에듀노트 (EduNote) — Developed by 송동석
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;
