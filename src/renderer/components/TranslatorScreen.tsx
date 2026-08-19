import React, { useState } from 'react';
import { ArrowRight, Copy, Languages, Loader2 } from 'lucide-react';
import { TRANSLATION_LANGUAGES, languageByCode, translateText } from '../lib/translation';
import { notifyToast } from '../lib/toast';

// 간단 번역 — 가정통신문 안내, 학부모 문자, 알림장 문구 등을 빠르게 번역한다.
const TranslatorScreen: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [targetCode, setTargetCode] = useState('en');
  const [toKorean, setToKorean] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTranslate = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setIsLoading(true);
    setError('');
    try {
      const lang = languageByCode(targetCode);
      const targetLabel = toKorean ? '한국어' : lang ? `${lang.label}(${lang.native})` : '영어';
      const result = await translateText(text, targetLabel);
      setOutput(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '번역 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    notifyToast({ type: 'success', title: '번역문을 복사했습니다.' });
  };

  return (
    <div className="h-full overflow-y-auto bg-[#FAF9F7] dark:bg-[#171210] p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <Languages className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1C1917] dark:text-[#F0EBE6]">간단 번역</h2>
            <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">
              학부모 안내 문구, 문자, 알림장 내용을 다문화 가정 언어로 빠르게 번역합니다.
            </p>
          </div>
        </div>

        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 leading-relaxed">
          ⚠️ 입력한 내용은 개인정보 보호 모드와 무관하게 원본 그대로 AI에 전송됩니다. 사람 이름·연락처는 번역하지 않고 그대로 남습니다.
        </p>

        <div className="bg-white dark:bg-[#221E1B] rounded-xl border border-[#EDE8E1] dark:border-[#2E2822] p-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">번역 방향</span>
          <select
            value={toKorean ? 'to-ko' : 'from-ko'}
            onChange={e => setToKorean(e.target.value === 'to-ko')}
            className="px-3 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#171210] text-sm text-[#1C1917] dark:text-[#F0EBE6] outline-none"
          >
            <option value="from-ko">한국어 → 외국어</option>
            <option value="to-ko">외국어 → 한국어</option>
          </select>
          {!toKorean && (
            <select
              value={targetCode}
              onChange={e => setTargetCode(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#171210] text-sm text-[#1C1917] dark:text-[#F0EBE6] outline-none"
            >
              {TRANSLATION_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.label} · {lang.native}</option>
              ))}
            </select>
          )}
          <button
            onClick={handleTranslate}
            disabled={!input.trim() || isLoading}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-[#E7E5E4] dark:disabled:bg-[#2E2822] text-white text-sm font-bold transition-colors"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {isLoading ? '번역 중...' : '번역'}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-[#221E1B] rounded-xl border border-[#EDE8E1] dark:border-[#2E2822] p-4">
            <label className="block text-xs font-bold text-[#44403C] dark:text-[#C4B8B0] mb-2">원문</label>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              className="w-full min-h-[320px] px-3 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#171210] text-sm text-[#1C1917] dark:text-[#F0EBE6] outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder="번역할 내용을 입력하세요. 예: 내일은 현장체험학습이 있습니다. 도시락과 물을 준비해 주세요."
            />
          </div>
          <div className="bg-white dark:bg-[#221E1B] rounded-xl border border-[#EDE8E1] dark:border-[#2E2822] p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#44403C] dark:text-[#C4B8B0]">번역문</label>
              <button
                onClick={handleCopy}
                disabled={!output}
                className="flex items-center gap-1 px-2 py-1 rounded border border-[#EDE8E1] dark:border-[#2E2822] text-xs text-[#78716C] dark:text-[#9C8F87] disabled:opacity-40 hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]"
              >
                <Copy className="w-3 h-3" />
                복사
              </button>
            </div>
            <div className="w-full min-h-[320px] px-3 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] bg-[#FAF9F7] dark:bg-[#171210] text-sm text-[#1C1917] dark:text-[#F0EBE6] whitespace-pre-wrap break-words">
              {output || <span className="text-[#A8A29E] dark:text-[#6B5E57]">번역 결과가 여기에 표시됩니다.</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranslatorScreen;
