import React, { useState, useEffect } from 'react';
import { generateClassManagementLog } from '../services/geminiService';
import { useGenerationTracker } from '../hooks/useGenerationTracker';
import { AppMode } from '../types';

const EXAMPLE_RESULT = `【 학급경영일지 】

■ 주 차: 3월 2주
■ 기 간: 2026. 3. 10.(화) ~ 3. 14.(토)
■ 학 급: 5학년 2반

1. 주요 학급 활동
  - 과학 실험(산과 염기) 수업을 실시함.
  - 학급 자치회의를 열어 3월 학급 규칙을 함께 결정함.
  - 체험학습 사전 준비 안내장을 배부하고 동의서를 수거함.

2. 학생 특이사항
  - 김○수: 결석 1일(가정 사유), 복귀 후 학습 내용 보충 지도함.
  - 이○영: 모둠 활동에서 적극적으로 리더십을 발휘하는 모습이 두드러짐.

3. 학부모 소통
  - 체험학습 관련 학부모 문의 전화 2건 응대함.
  - 상담 희망 학부모 1명과 전화 상담 실시함.

4. 다음 주 계획
  - 체험학습 최종 안내 및 준비물 확인 예정임.
  - 3월 학업성취도 점검을 위한 간이 평가 실시 예정임.
  - 학급 환경 게시판 정비 예정임.

※ 이 문서는 AI가 생성한 예시입니다. 실제 학급 활동 내용으로 교체하여 사용하세요.`;

const ClassManagementLogGenerator: React.FC = () => {
  const { startGeneration, endGeneration } = useGenerationTracker(AppMode.CLASS_LOG);
  const [week, setWeek] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [grade, setGrade] = useState('');
  const [keyActivities, setKeyActivities] = useState('');
  const [studentIssues, setStudentIssues] = useState('');
  const [teacherNotes, setTeacherNotes] = useState('');
  const [result, setResult] = useState(EXAMPLE_RESULT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.electronAPI.getConfig('gradeClass').then((gc: string) => {
      if (gc) setGrade(gc);
    });
  }, []);

  const handleGenerate = async () => {
    if (!week.trim() || !dateRange.trim() || !grade.trim() || !keyActivities.trim()) {
      setError('주차, 날짜 범위, 학년/반, 주요 활동은 필수 입력 항목입니다.');
      return;
    }
    setError('');
    setResult('');
    setIsLoading(true);
    startGeneration();
    try {
      const generated = await generateClassManagementLog({
        week,
        dateRange,
        grade,
        keyActivities,
        studentIssues,
        teacherNotes,
      });
      setResult(generated);
    } catch (err: any) {
      setError(err?.message || '생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      endGeneration();
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleSaveTxt = () => {
    if (!result) return;
    window.electronAPI.saveTxt(result, '학급경영일지.txt');
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800 transition-colors">
      <div className="px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mr-3 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">학급경영일지 생성</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">주간 활동 내용을 입력하면 학급경영일지를 생성합니다</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                주차 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                placeholder="예: 3월 2주"
                className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                날짜 범위 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                placeholder="예: 2026. 3. 10.(화) ~ 3. 14.(토)"
                className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              학년/반 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="예: 5학년 2반"
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              주요 활동 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={keyActivities}
              onChange={(e) => setKeyActivities(e.target.value)}
              placeholder="이번 주 주요 수업 활동, 행사, 특별 프로그램 등을 입력하세요.&#10;예: 과학 실험, 체험학습 준비, 학부모 상담"
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none min-h-[150px]"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              학생 특이사항 <span className="text-xs font-normal text-slate-400">(선택)</span>
            </label>
            <textarea
              value={studentIssues}
              onChange={(e) => setStudentIssues(e.target.value)}
              placeholder="이번 주 특이 사항이 있었던 학생 관련 내용을 입력하세요. (선택 사항)"
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none min-h-[80px]"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              담임 소감/메모 <span className="text-xs font-normal text-slate-400">(선택)</span>
            </label>
            <textarea
              value={teacherNotes}
              onChange={(e) => setTeacherNotes(e.target.value)}
              placeholder="이번 주를 마치며 담임 교사의 소감이나 메모를 자유롭게 입력하세요. (선택 사항)"
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none min-h-[80px]"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                생성 중...
              </>
            ) : '학급경영일지 생성'}
          </button>

          {result && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">생성 결과</h3>
                  {result === EXAMPLE_RESULT && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">예시</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center gap-1"
                  >
                    {copied ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-green-500">
                          <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                        </svg>
                        복사됨
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        복사
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSaveTxt}
                    className="px-3 py-1.5 text-xs font-bold bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    TXT 저장
                  </button>
                </div>
              </div>
              <div className={`rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto shadow-inner ${result === EXAMPLE_RESULT ? 'bg-amber-50 border border-amber-200 text-slate-600' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'}`}>
                {result}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClassManagementLogGenerator;
