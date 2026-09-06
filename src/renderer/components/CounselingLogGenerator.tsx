import React, { useState, useEffect } from 'react';
import { MessageCircle, Loader2, Copy, Download, AlertCircle } from 'lucide-react';
import { generateCounselingLog } from '../services/geminiService';
import { useGenerationTracker } from '../hooks/useGenerationTracker';
import { AppMode } from '../types';
import { playSuccessSound } from '../lib/soundEffect';
import { copyPlainTextToClipboard } from '../lib/clipboard';
import { notifyToast } from '../lib/toast';
import { prepareAndRunWithAbort } from '../lib/cancellation';

const COUNSELING_TYPES = ['학습상담', '생활상담', '진로상담', '심리상담', '기타'];

const EXAMPLE_RESULT = `【 상담일지 】

■ 일 시: ${new Date().getFullYear()}. 3. 20.(금) 14:00~14:30
■ 유 형: 생활상담
■ 참여자: 담임교사, 학생(김○수)

1. 상담 목적
  - 최근 수업 중 집중력 저하 및 지각 반복 문제로 면담 실시함.

2. 주요 상담 내용
  - 학생이 가정 내 환경 변화(부모 맞벌이 시작)로 기상 어려움을 호소함.
  - 스스로 문제를 인식하고 있으나 해결 방법을 모르는 상태임.
  - 알람 2개 설정, 전날 준비물 미리 챙기기 등 구체적 방법을 함께 논의함.

3. 학생 반응
  - 처음에는 소극적이었으나 점차 자신의 어려움을 솔직히 이야기함.
  - 개선 의지를 보이며 담임 교사의 조언을 수용함.

4. 조치 사항
  - 1주일간 등교 현황을 담임이 직접 확인하기로 함.
  - 필요시 학부모 연락 예정임.

5. 후속 지원 계획
  - 2주 후 재면담을 통해 개선 여부를 확인하기로 함.
  - 지속될 경우 학교 상담 교사와 연계하기로 함.`;

const CounselingLogGenerator: React.FC = () => {
  const { startGeneration, endGeneration, callWithAbort } = useGenerationTracker(AppMode.COUNSELING_LOG);
  const [date, setDate] = useState('');
  const [counselingType, setCounselingType] = useState('생활상담');
  const [participants, setParticipants] = useState('');
  const [studentName, setStudentName] = useState('');
  const [counselingContent, setCounselingContent] = useState('');
  const [followUpPlan, setFollowUpPlan] = useState('');
  const [result, setResult] = useState(EXAMPLE_RESULT);
  const [resultModel, setResultModel] = useState('');
  const [resultPrivacyApplied, setResultPrivacyApplied] = useState(false);

  React.useEffect(() => {
    window.electronAPI.getConfig('teacherName').then((v: string) => {
      if (v) setParticipants(prev => prev || `담임교사(${v}), 학생`);
    });
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = () => setIsLoading(false);
    window.addEventListener('edunote-generation-reset', handler);
    return () => window.removeEventListener('edunote-generation-reset', handler);
  }, []);

  const handleGenerate = async () => {
    if (!counselingContent.trim()) {
      setError('상담 내용은 필수 입력 항목입니다.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult('');
    setResultModel('');
    setResultPrivacyApplied(false);
    startGeneration();
    try {
      // 개인정보 보호 모드(기본 켜짐): 학생 이름을 토큰으로 바꿔 AI에 보내고 결과에서 복원한다
      const { text: output, model, privacyApplied } = await prepareAndRunWithAbort(
        callWithAbort,
        () => window.electronAPI.getConfig('privacyModeEnabled').catch(() => true),
        privacyMode => generateCounselingLog({ date, counselingType, participants, studentName, counselingContent, followUpPlan, privacyModeEnabled: privacyMode !== false }),
      );
      setResult(output);
      setResultModel(model);
      setResultPrivacyApplied(privacyApplied);
      playSuccessSound();
    } catch (e) {
      if (!(e instanceof Error && e.message === 'CANCELLED')) {
        setError(e instanceof Error ? e.message : '생성 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
      endGeneration();
    }
  };

  const handleCopy = async () => {
    if (!await copyPlainTextToClipboard(result)) {
      notifyToast({ type: 'error', title: '클립보드 복사에 실패했습니다.' });
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    await window.electronAPI.saveTxt(result, `상담일지_${studentName || '학생'}_${date || new Date().toISOString().slice(0, 10)}.txt`);
  };

  const inputClass = 'w-full bg-white dark:bg-[#2E2822] rounded-md border border-[#E7E5E4] dark:border-[#2E2822] text-[#1C1917] dark:text-[#F0EBE6] dark:placeholder-[#6B5E57] text-sm focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] outline-none p-2.5 transition-all';
  const labelClass = 'block text-sm font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1.5';

  return (
    <div className="flex flex-col h-full bg-[#FAF9F7] dark:bg-[#171210] overflow-y-auto transition-colors">
      <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
        <div className="bg-white dark:bg-[#221E1B] rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded-lg">
              <MessageCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="font-bold text-[#1C1917] dark:text-[#F0EBE6]">상담일지 생성</h2>
          </div>
          <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">상담 내용을 입력하면 형식에 맞는 상담일지를 생성합니다.</p>
        </div>

        <div className="bg-white dark:bg-[#221E1B] rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] shadow-sm p-4 space-y-4">
          <div>
            <label className={labelClass}>상담 유형</label>
            <div className="flex flex-wrap gap-2">
              {COUNSELING_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setCounselingType(type)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                    counselingType === type
                      ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-400 dark:border-purple-700 text-purple-700 dark:text-purple-300 font-bold'
                      : 'bg-white dark:bg-[#2E2822] border-[#E7E5E4] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#FAF9F7] dark:hover:bg-[#3A332D]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>상담 일시</label>
              <input type="text" className={inputClass} placeholder={`예: ${new Date().getFullYear()}. 3. 20. 14:00`} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>학생 이름 <span className="text-xs text-orange-500 font-normal">(개인정보 주의)</span></label>
              <input type="text" className={inputClass} placeholder="이니셜 사용 권장 (예: 김O수)" value={studentName} onChange={e => setStudentName(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass}>상담 참여자</label>
            <input type="text" className={inputClass} placeholder="예: 학생, 담임교사, 학부모" value={participants} onChange={e => setParticipants(e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>상담 내용 <span className="text-red-500">*</span></label>
            <textarea
              className={`${inputClass} min-h-[180px] resize-y`}
              placeholder="상담 주제, 학생의 호소 내용, 면담 내용 등을 자유롭게 입력하세요."
              value={counselingContent}
              onChange={e => setCounselingContent(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>후속 지원 계획 (선택)</label>
            <textarea
              className={`${inputClass} min-h-[80px] resize-y`}
              placeholder="추후 지원 계획이 있으면 입력하세요."
              value={followUpPlan}
              onChange={e => setFollowUpPlan(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-100 dark:border-red-800 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-md text-white font-bold text-sm transition-all ${
              isLoading ? 'bg-[#A8A29E] cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                생성 중...
              </>
            ) : '상담일지 생성'}
          </button>
        </div>

        {result && (
          <div className="bg-white dark:bg-[#221E1B] rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[#1C1917] dark:text-[#F0EBE6] text-sm">생성 결과</h3>
                {result === EXAMPLE_RESULT && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">예시</span>
                )}
                {resultModel && (
                  <span className="text-[10px] text-[#A8A29E] bg-[#EDE8E1] dark:bg-[#2E2822] px-2 py-0.5 rounded-full font-medium" title="이 결과를 생성한 AI 모델">
                    {resultModel}
                  </span>
                )}
                {resultModel && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      resultPrivacyApplied
                        ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40'
                        : 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40'
                    }`}
                    title={resultPrivacyApplied ? '개인정보 보호 모드로 이름을 가려 전송했습니다.' : '개인정보 보호 모드가 꺼져 있거나 적용되지 않아 이름이 그대로 전송되었습니다.'}
                  >
                    {resultPrivacyApplied ? '🔒 이름 가림' : '이름 그대로 전송'}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-[#78716C] dark:text-[#9C8F87] hover:text-[#1C1917] dark:hover:text-[#F0EBE6] border border-[#EDE8E1] dark:border-[#2E2822] rounded px-3 py-1.5 hover:bg-[#FAF9F7] dark:hover:bg-[#2E2822]">
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? '복사됨!' : '복사'}
                </button>
                <button onClick={handleSave} className="flex items-center gap-1 text-xs text-white bg-purple-600 hover:bg-purple-700 rounded px-3 py-1.5">
                  <Download className="w-3.5 h-3.5" />
                  TXT 저장
                </button>
              </div>
            </div>
            <div className={`rounded-md border p-4 text-sm whitespace-pre-wrap leading-relaxed ${result === EXAMPLE_RESULT ? 'bg-amber-50 border-amber-200 text-[#78716C]' : 'bg-[#FAF9F7] dark:bg-[#171210] border-[#EDE8E1] dark:border-[#2E2822] text-[#1C1917] dark:text-[#F0EBE6]'}`}>
              {result}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CounselingLogGenerator;
