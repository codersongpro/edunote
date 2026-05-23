import React, { useState, useEffect } from 'react';
import { ClipboardList, Loader2, Copy, Download, AlertCircle } from 'lucide-react';
import { generateLessonObservation } from '../services/geminiService';
import { useGenerationTracker } from '../hooks/useGenerationTracker';
import { AppMode } from '../types';

const LessonObservationGenerator: React.FC = () => {
  const { startGeneration, endGeneration } = useGenerationTracker(AppMode.LESSON_OBSERVATION);
  const [date, setDate] = useState('');
  const [subject, setSubject] = useState('');
  const [unit, setUnit] = useState('');
  const [grade, setGrade] = useState('');
  const [observationNotes, setObservationNotes] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.electronAPI.getConfig('teacherName').then((v: string) => {
      if (v) setTeacherName(v);
    });
  }, []);

  const handleGenerate = async () => {
    if (!subject.trim() || !observationNotes.trim()) {
      setError('교과와 관찰 내용은 필수 입력 항목입니다.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult('');
    startGeneration();
    try {
      const output = await generateLessonObservation({ date, subject, unit, grade, observationNotes, teacherName });
      setResult(output);
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      endGeneration();
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    await window.electronAPI.saveTxt(result, `수업관찰기록_${subject}_${date || new Date().toISOString().slice(0, 10)}.txt`);
  };

  const inputClass = 'w-full bg-white rounded-md border border-gray-300 text-gray-800 text-sm focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] outline-none p-2.5 transition-all';
  const labelClass = 'block text-sm font-bold text-gray-700 mb-1.5';

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA] overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-blue-100 p-1.5 rounded-lg">
              <ClipboardList className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="font-bold text-gray-800">수업관찰기록 생성</h2>
          </div>
          <p className="text-xs text-gray-500">수업 관찰 내용을 입력하면 정형화된 수업관찰기록을 생성합니다.</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>교과 <span className="text-red-500">*</span></label>
              <input type="text" className={inputClass} placeholder="예: 수학" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>학년/반</label>
              <input type="text" className={inputClass} placeholder="예: 5학년 2반" value={grade} onChange={e => setGrade(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>단원</label>
            <input type="text" className={inputClass} placeholder="예: 3-1. 분수의 덧셈" value={unit} onChange={e => setUnit(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>일시</label>
              <input type="text" className={inputClass} placeholder="예: 2026. 3. 15.(일) 2교시" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>수업 교사</label>
              <input type="text" className={inputClass} placeholder="교사 이름" value={teacherName} onChange={e => setTeacherName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>관찰 내용 <span className="text-red-500">*</span></label>
            <textarea
              className={`${inputClass} min-h-[150px] resize-y`}
              placeholder="수업 중 관찰한 교수·학습 활동, 학생 반응, 특이사항 등을 자유롭게 입력하세요."
              value={observationNotes}
              onChange={e => setObservationNotes(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md border border-red-100 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-md text-white font-bold text-sm transition-all ${
              isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#1E88E5] hover:bg-[#1565C0]'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                생성 중...
              </>
            ) : '수업관찰기록 생성'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800 text-sm">생성 결과</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? '복사됨!' : '복사'}
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 text-xs text-white bg-[#1E88E5] hover:bg-[#1565C0] rounded px-3 py-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  TXT 저장
                </button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-md border border-gray-200 p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {result}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonObservationGenerator;
