import React, { useState, useRef } from 'react';
import { CustomTool } from '../types';
import { generateHtmlApp } from '../services/geminiService';
import { Monitor, Sparkles, RefreshCw, Save, Code, ExternalLink, X, ChevronLeft, Plus, GripVertical, AlertTriangle } from 'lucide-react';
import { useGlobalState } from '../GlobalStateContext';

const CATEGORY_OPTIONS: { value: CustomTool['category']; label: string }[] = [
  { value: 'lesson', label: '수업 자료' },
  { value: 'admin', label: '교무 행정' },
  { value: 'student', label: '학생 관리' },
  { value: 'other', label: '기타' },
];

interface Example {
  label: string;
  appType: string;
  features: string[];
  extra: string;
}

const EXAMPLES: Example[] = [
  {
    label: '팀별 점수판',
    appType: '팀별 점수판',
    features: ['팀 이름 4개 설정 가능', '+1/-1/+5 버튼으로 점수 조절', '점수 변경 시 효과음(Web Audio API)', '전체 초기화 버튼'],
    extra: '',
  },
  {
    label: '랜덤 모둠 편성기',
    appType: '랜덤 모둠 편성기',
    features: ['학생 이름 한 줄씩 붙여넣기', '모둠 수 선택(2~8모둠)', '자동 편성 후 색상 구분 카드로 표시', '다시 섞기 버튼'],
    extra: '',
  },
  {
    label: '수업 타이머',
    appType: '수업 타이머',
    features: ['분/초 직접 설정', '컬러 링 진행바(SVG)', '종료 시 효과음(Web Audio API)', '전체화면 버튼', '시작/일시정지/재개/초기화'],
    extra: '',
  },
  {
    label: '어휘 플래시카드',
    appType: '어휘 플래시카드',
    features: [
      '다음 단어/뜻 쌍을 카드로 미리 넣어 바로 동작: 사과/apple, 책/book, 학교/school, 친구/friend, 선생님/teacher, 공부하다/study',
      '카드를 클릭하면 앞면(단어)과 뒷면(뜻)이 뒤집히는 애니메이션',
      '이전/다음 버튼으로 카드 넘기기',
      '맞힘/틀림 버튼과 정답률(%) 표시',
      '한 줄에 단어/뜻 하나씩 직접 추가·수정 가능',
    ],
    extra: '',
  },
  {
    label: '칭찬 포인트 관리',
    appType: '칭찬 포인트 관리',
    features: ['학생 이름 목록 붙여넣기', '이름 클릭으로 포인트 +1/-1', '포인트 순위 실시간 정렬', '초기화 버튼'],
    extra: '',
  },
];

function parseDescription(desc: string): { appType: string; features: string[]; extra: string } {
  if (!desc) return { appType: '', features: [], extra: '' };
  const dot = desc.indexOf('.');
  if (dot === -1) return { appType: desc.trim(), features: [], extra: '' };
  const appType = desc.slice(0, dot).trim();
  const rest = desc.slice(dot + 1).trim();
  const features = rest.split(',').map(f => f.trim()).filter(Boolean);
  return { appType, features, extra: '' };
}

function buildDescription(appType: string, features: string[], extra: string): string {
  const parts = [appType.trim()];
  const featurePart = features.filter(Boolean).join(', ');
  if (featurePart) parts.push(featurePart);
  if (extra.trim()) parts.push(extra.trim());
  return parts.join('. ');
}

interface HtmlAppCreatorProps {
  initial?: CustomTool;
  onSave: (draft: Omit<CustomTool, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const HtmlAppCreator: React.FC<HtmlAppCreatorProps> = ({ initial, onSave, onCancel }) => {
  const { apiKeyAvailability } = useGlobalState();
  const parsed = parseDescription(initial?.description ?? '');
  const [appType, setAppType] = useState(parsed.appType);
  const [features, setFeatures] = useState<string[]>(parsed.features.length > 0 ? parsed.features : ['']);
  const [extra, setExtra] = useState(parsed.extra);
  const [htmlContent, setHtmlContent] = useState(initial?.htmlContent ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<CustomTool['category']>(initial?.category ?? 'lesson');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const featureInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const description = buildDescription(appType, features, extra);
  const canGenerate = appType.trim().length > 0 && !isGenerating && apiKeyAvailability !== 'wait';

  const handleGenerate = async () => {
    if (!canGenerate) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsGenerating(true);
    setError('');
    setShowCode(false);
    try {
      const html = await generateHtmlApp(description, abortRef.current.signal);
      setHtmlContent(html);
      if (!name) setName(appType.trim().slice(0, 24));
    } catch (e: any) {
      if (!e?.message?.includes('취소')) setError(e?.message || 'HTML 앱 생성에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCancel = () => {
    abortRef.current?.abort();
    setIsGenerating(false);
  };

  const handleSave = () => {
    if (!name.trim() || !htmlContent) return;
    onSave({
      name: name.trim(),
      description,
      category,
      toolType: 'html-app',
      inputs: [],
      promptTemplate: '',
      htmlContent,
    });
  };

  const applyExample = (ex: Example) => {
    setAppType(ex.appType);
    setFeatures(ex.features.length > 0 ? [...ex.features] : ['']);
    setExtra(ex.extra);
  };

  const updateFeature = (idx: number, value: string) => {
    setFeatures(prev => prev.map((f, i) => i === idx ? value : f));
  };

  const addFeature = (afterIdx?: number) => {
    setFeatures(prev => {
      const next = [...prev];
      const insertAt = afterIdx !== undefined ? afterIdx + 1 : prev.length;
      next.splice(insertAt, 0, '');
      return next;
    });
    const focusIdx = afterIdx !== undefined ? afterIdx + 1 : features.length;
    setTimeout(() => featureInputRefs.current[focusIdx]?.focus(), 30);
  };

  const removeFeature = (idx: number) => {
    if (features.length === 1) {
      setFeatures(['']);
      return;
    }
    setFeatures(prev => prev.filter((_, i) => i !== idx));
    setTimeout(() => {
      const prevIdx = Math.max(0, idx - 1);
      featureInputRefs.current[prevIdx]?.focus();
    }, 30);
  };

  const handleFeatureKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFeature(idx);
    } else if (e.key === 'Backspace' && features[idx] === '' && features.length > 1) {
      e.preventDefault();
      removeFeature(idx);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF9F7] dark:bg-[#171210]">
      {/* 헤더 */}
      <div className="bg-white dark:bg-[#171210] border-b border-[#E7E5E4] dark:border-[#2E2822] px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-[#EDE8E1] dark:hover:bg-[#221E1B] text-[#A8A29E] transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <Monitor className="w-5 h-5 text-violet-500" />
          <div>
            <h1 className="text-base font-extrabold text-[#1C1917] dark:text-[#F0EBE6]">HTML 앱 만들기</h1>
            <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">원하는 앱을 설명하면 AI가 즉시 만들어드립니다</p>
          </div>
        </div>
      </div>

      {apiKeyAvailability !== 'usable' && (
        <div className="mx-6 mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
              {apiKeyAvailability === 'wait' ? 'API가 일시적으로 제한되었습니다' : 'API 키를 설정하거나 확인해 주세요'}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
              {apiKeyAvailability === 'wait'
                ? '잠시 후 다시 시도하거나 설정에서 API 키를 변경해 주세요.'
                : 'Gemini API 키가 없거나 아직 확인되지 않았습니다. 설정에서 API 키를 입력하거나 한 번 생성해 보세요.'}
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('edunote-goto-settings'))}
              className="mt-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
            >
              설정 바로가기 →
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* 예시 칩 */}
        {!htmlContent && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-[#A8A29E] dark:text-[#6B5E57]">예시 클릭하면 자동 입력돼요</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => applyExample(ex)}
                  className="px-2.5 py-1 text-xs bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700 rounded-full hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 입력 필드 */}
        <div className="bg-white dark:bg-[#171210] rounded-xl border border-[#E7E5E4] dark:border-[#2E2822] p-4 space-y-4">

          {/* 앱 이름/종류 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#44403C] dark:text-[#C4B8B0]">
              앱 이름 / 종류 <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={appType}
              onChange={e => setAppType(e.target.value)}
              placeholder="예: 팀별 점수판, 수업 타이머, 어휘 플래시카드"
              className="w-full px-3 py-2 text-sm border border-[#E7E5E4] dark:border-[#2E2822] rounded-lg bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          {/* 기능 목록 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#44403C] dark:text-[#C4B8B0]">
              기능 목록
              <span className="ml-1.5 text-[11px] font-normal text-[#A8A29E] dark:text-[#6B5E57]">Enter로 줄 추가, Backspace로 빈 줄 삭제</span>
            </label>
            <div className="space-y-1.5">
              {features.map((f, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="text-[#E7E5E4] dark:text-[#2E2822] shrink-0">
                    <GripVertical className="w-3.5 h-3.5" />
                  </span>
                  <input
                    ref={el => { featureInputRefs.current[idx] = el; }}
                    value={f}
                    onChange={e => updateFeature(idx, e.target.value)}
                    onKeyDown={e => handleFeatureKeyDown(e, idx)}
                    placeholder={idx === 0 ? '예: +1/-1 버튼으로 점수 조절' : '예: 효과음(Web Audio API)'}
                    className="flex-1 px-3 py-1.5 text-sm border border-[#E7E5E4] dark:border-[#2E2822] rounded-lg bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                  <button
                    onClick={() => removeFeature(idx)}
                    className="p-1 text-[#E7E5E4] dark:text-[#2E2822] hover:text-red-400 transition-colors shrink-0"
                    tabIndex={-1}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => addFeature()}
              className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300 font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> 기능 추가
            </button>
          </div>

          {/* 추가 요청 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#44403C] dark:text-[#C4B8B0]">
              추가 요청 <span className="text-[11px] font-normal text-[#A8A29E] dark:text-[#6B5E57]">(선택)</span>
            </label>
            <textarea
              value={extra}
              onChange={e => setExtra(e.target.value)}
              placeholder="예: 전체화면 지원, 모바일 반응형, 파스텔 색상 테마"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-[#E7E5E4] dark:border-[#2E2822] rounded-lg bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
            />
          </div>

          {/* AI 전달 문구 미리보기 */}
          {description.length > 1 && (
            <div className="bg-[#FAF9F7] dark:bg-[#221E1B]/50 rounded-lg px-3 py-2 text-xs text-[#78716C] dark:text-[#9C8F87]">
              <span className="font-semibold text-[#A8A29E] dark:text-[#6B5E57] mr-1">AI 전달:</span>
              {description}
            </div>
          )}

          {/* 생성 버튼 */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-500 hover:bg-violet-600 disabled:bg-[#EDE8E1] dark:disabled:bg-[#2E2822] text-white text-sm font-bold rounded-xl transition-colors"
            >
              {isGenerating
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Sparkles className="w-4 h-4" />}
              {isGenerating ? 'AI가 만드는 중...' : htmlContent ? '다시 만들기' : 'AI로 만들기'}
            </button>
            {isGenerating && (
              <button
                onClick={handleGenerateCancel}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-[#78716C] border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl hover:bg-[#FAF9F7] dark:hover:bg-[#221E1B] transition-colors"
              >
                <X className="w-3.5 h-3.5" /> 취소
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* 미리보기 */}
        {htmlContent && (
          <div className="bg-white dark:bg-[#171210] rounded-xl border border-[#E7E5E4] dark:border-[#2E2822] overflow-hidden flex flex-col" style={{ height: '420px' }}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#EDE8E1] dark:border-[#2E2822] shrink-0">
              <span className="text-xs font-semibold text-[#78716C] dark:text-[#9C8F87] flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5" /> 미리보기
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => window.electronAPI.openHtmlExternal(htmlContent, name || 'html-app')}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-[#78716C] hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> 브라우저에서 열기
                </button>
                <button
                  onClick={() => setShowCode(!showCode)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-[#78716C] hover:text-[#44403C] dark:hover:text-[#C4B8B0] hover:bg-[#FAF9F7] dark:hover:bg-[#221E1B] rounded-lg transition-colors"
                >
                  <Code className="w-3.5 h-3.5" /> {showCode ? '미리보기' : '코드 보기'}
                </button>
              </div>
            </div>
            {showCode ? (
              <textarea
                value={htmlContent}
                onChange={e => setHtmlContent(e.target.value)}
                className="flex-1 px-4 py-3 text-xs font-mono bg-[#FAF9F7] dark:bg-[#221E1B] text-[#1C1917] dark:text-[#C4B8B0] resize-none focus:outline-none"
              />
            ) : (
              <iframe
                key={htmlContent.length}
                // sandbox에 allow-same-origin을 추가하면 AI가 만든 HTML이 앱 컨텍스트(localStorage 등)에
                // 접근할 수 있게 되므로 절대 추가하면 안 된다.
                sandbox="allow-scripts allow-forms allow-modals"
                allow="fullscreen"
                srcDoc={htmlContent}
                className="flex-1 w-full border-0"
                title="HTML App Preview"
              />
            )}
          </div>
        )}

        {/* 저장 */}
        {htmlContent && (
          <div className="bg-white dark:bg-[#171210] rounded-xl border border-[#E7E5E4] dark:border-[#2E2822] p-4 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-[#44403C] dark:text-[#C4B8B0] mb-1">
                  앱 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="예: 팀별 점수판"
                  className="w-full px-3 py-2 text-sm border border-[#E7E5E4] dark:border-[#2E2822] rounded-lg bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#44403C] dark:text-[#C4B8B0] mb-1">카테고리</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as CustomTool['category'])}
                  className="px-3 py-2 text-sm border border-[#E7E5E4] dark:border-[#2E2822] rounded-lg bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] focus:outline-none focus:ring-2 focus:ring-violet-400"
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
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-500 hover:bg-violet-600 disabled:bg-[#EDE8E1] dark:disabled:bg-[#2E2822] text-white text-sm font-bold rounded-xl transition-colors"
            >
              <Save className="w-4 h-4" />
              내 스킬에 저장
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HtmlAppCreator;
