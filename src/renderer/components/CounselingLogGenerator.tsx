import React, { useState } from 'react';
import { MessageCircle, Loader2, Copy, Download, AlertCircle } from 'lucide-react';
import { generateCounselingLog } from '../services/geminiService';

const COUNSELING_TYPES = ['학습상담', '생활상담', '진로상담', '심리상담', '기타'];

const CounselingLogGenerator: React.FC = () => {
  const [date, setDate] = useState('');
  const [counselingType, setCounselingType] = useState('생활상담');
  const [participants, setParticipants] = useState('');
  const [studentName, setStudentName] = useState('');
  const [counselingContent, setCounselingContent] = useState('');
  const [followUpPlan, setFollowUpPlan] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!counselingContent.trim()) {
      setError('상담 내용은 필수 입력 항목입니다.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult('');
    try {
      const output = await generateCounselingLog({ date, counselingType, participants, studentName, counselingContent, followUpPlan });
      setResult(output);
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    await window.electronAPI.saveTxt(result, `상담일지_${studentName || '학생'}_${date || new Date().toISOString().slice(0, 10)}.txt`);
  };

  const inputClass = 'w-full bg-white rounded-md border border-gray-300 text-gray-800 text-sm focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] outline-none p-2.5 transition-all';
  const labelClass = 'block text-sm font-bold text-gray-700 mb-1.5';

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA] overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-purple-100 p-1.5 rounded-lg">
              <MessageCircle className="w-4 h-4 text-purple-600" />
            </div>
            <h2 className="font-bold text-gray-800">상담일지 생성</h2>
          </div>
          <p className="text-xs text-gray-500">상담 내용을 입력하면 형식에 맞는 상담일지를 생성합니다.</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-4">
          <div>
            <label className={labelClass}>상담 유형</label>
            <div className="flex flex-wrap gap-2">
              {COUNSELING_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setCounselingType(type)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                    counselingType === type
                      ? 'bg-purple-100 border-purple-400 text-purple-700 font-bold'
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
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
              <input type="text" className={inputClass} placeholder="예: 2026. 3. 20. 14:00" value={date} onChange={e => setDate(e.target.value)} />
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
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md border border-red-100 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-md text-white font-bold text-sm transition-all ${
              isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
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
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800 text-sm">생성 결과</h3>
              <div className="flex gap-2">
                <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50">
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? '복사됨!' : '복사'}
                </button>
                <button onClick={handleSave} className="flex items-center gap-1 text-xs text-white bg-purple-600 hover:bg-purple-700 rounded px-3 py-1.5">
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

export default CounselingLogGenerator;
