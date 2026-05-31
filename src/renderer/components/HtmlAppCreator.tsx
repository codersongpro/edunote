import React, { useState, useRef } from 'react';
import { CustomTool } from '../types';
import { generateHtmlApp } from '../services/geminiService';
import { Monitor, Sparkles, RefreshCw, Save, Code, ExternalLink, X, ChevronLeft } from 'lucide-react';

const CATEGORY_OPTIONS: { value: CustomTool['category']; label: string }[] = [
  { value: 'lesson', label: '수업 자료' },
  { value: 'admin', label: '교무 행정' },
  { value: 'student', label: '학생 관리' },
  { value: 'other', label: '기타' },
];

const EXAMPLES = [
  '팀별 점수판. 팀 이름 4개 설정, 버튼으로 점수 올리기/내리기, 효과음 포함',
  '랜덤 모둠 편성기. 학생 이름 붙여넣기 → 모둠 수 설정 → 자동 편성, 다시 섞기 버튼',
  '수업 타이머. 분/초 설정, 진행바, 종료 알람, 전체화면 지원',
  '어휘 플래시카드. 단어/뜻 직접 입력 → 카드 뒤집기 게임, 맞힌 수 표시',
  '상점(칭찬 포인트) 관리. 학생 목록 입력, 포인트 추가/차감, 순위 표시',
];

interface HtmlAppCreatorProps {
  initial?: CustomTool;
  onSave: (draft: Omit<CustomTool, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const HtmlAppCreator: React.FC<HtmlAppCreatorProps> = ({ initial, onSave, onCancel }) => {
  const [description, setDescription] = useState(initial?.description ?? '');
  const [htmlContent, setHtmlContent] = useState(initial?.htmlContent ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<CustomTool['category']>(initial?.category ?? 'lesson');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = async () => {
    if (!description.trim() || isGenerating) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsGenerating(true);
    setError('');
    setShowCode(false);
    try {
      const html = await generateHtmlApp(description.trim(), abortRef.current.signal);
      setHtmlContent(html);
      if (!name) setName(description.trim().slice(0, 24));
    } catch (e: any) {
      if (!e?.message?.includes('취소')) setError('HTML 앱 생성에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setIsGenerating(false);
  };

  const handleSave = () => {
    if (!name.trim() || !htmlContent) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      category,
      toolType: 'html-app',
      inputs: [],
      promptTemplate: '',
      htmlContent,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA] dark:bg-gray-950">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <Monitor className="w-5 h-5 text-violet-500" />
          <div>
            <h1 className="text-base font-extrabold text-gray-900 dark:text-white">HTML 앱 만들기</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">원하는 앱을 설명하면 AI가 즉시 만들어드립니다</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* 설명 입력 */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <label className="text-sm font-bold text-gray-700 dark:text-gray-200">어떤 앱이 필요하세요?</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="예: 팀별 점수판. 팀 이름 4개 설정, 버튼으로 점수 올리기/내리기, 효과음 포함"
            rows={3}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
          />

          {/* 예시 칩 */}
          {!htmlContent && (
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setDescription(ex)}
                  className="px-2.5 py-1 text-xs bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700 rounded-full hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors truncate max-w-[280px]"
                >
                  {ex.split('.')[0]}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={!description.trim() || isGenerating}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-500 hover:bg-violet-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white text-sm font-bold rounded-xl transition-colors"
            >
              {isGenerating
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Sparkles className="w-4 h-4" />}
              {isGenerating ? 'AI가 만드는 중...' : htmlContent ? '다시 만들기' : 'AI로 만들기'}
            </button>
            {isGenerating && (
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-gray-500 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> 취소
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* 미리보기 */}
        {htmlContent && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col" style={{ height: '420px' }}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5" /> 미리보기
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => window.electronAPI.openHtmlExternal(htmlContent, name || 'html-app')}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-500 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> 브라우저에서 열기
                </button>
                <button
                  onClick={() => setShowCode(!showCode)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Code className="w-3.5 h-3.5" /> {showCode ? '미리보기' : '코드 보기'}
                </button>
              </div>
            </div>
            {showCode ? (
              <textarea
                value={htmlContent}
                onChange={e => setHtmlContent(e.target.value)}
                className="flex-1 px-4 py-3 text-xs font-mono bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 resize-none focus:outline-none"
              />
            ) : (
              <iframe
                key={htmlContent.length}
                sandbox="allow-scripts allow-forms"
                srcDoc={htmlContent}
                className="flex-1 w-full border-0"
                title="HTML App Preview"
              />
            )}
          </div>
        )}

        {/* 저장 */}
        {htmlContent && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  앱 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="예: 팀별 점수판"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">카테고리</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as CustomTool['category'])}
                  className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-500 hover:bg-violet-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white text-sm font-bold rounded-xl transition-colors"
            >
              <Save className="w-4 h-4" />
              AI스킬즈에 저장
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HtmlAppCreator;
