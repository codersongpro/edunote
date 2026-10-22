import React from 'react';
import { AlertCircle, AlertTriangle, CheckSquare, Globe, Info, Square } from 'lucide-react';
import type { GroundingInfo } from '../../preload/types';
import { DocSuggestion, SEVERITY_LABELS, SuggestionSeverity, isApplicable, isDefaultSelected } from '../lib/aiReview';

// 수정 제안 목록의 선택·수정 상태. 현행화·오류 검토 화면과 결과 화면의 검토 창이 함께 쓴다.
export function useSuggestionSelection(mode: 'refresh' | 'review') {
  const [items, setItems] = React.useState<DocSuggestion[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const itemsRef = React.useRef<DocSuggestion[]>([]);
  itemsRef.current = items;

  const reset = React.useCallback((next: DocSuggestion[]) => {
    setItems(next);
    setSelected(new Set(next.filter(s => isDefaultSelected(s, mode)).map(s => s.id)));
  }, [mode]);

  // AI 결과가 나중에 도착했을 때 쓴다. 이미 보이던 제안은 교사가 고른 체크와 고친 글자를 그대로 두고,
  // 새로 들어온 제안만 기본 선택 규칙을 적용한다.
  const extend = React.useCallback((next: DocSuggestion[]) => {
    const current = new Map(itemsRef.current.map(s => [s.id, s]));
    setItems(next.map(s => current.get(s.id) ?? s));
    setSelected(prev => new Set([
      ...[...prev].filter(id => next.some(s => s.id === id)),
      ...next.filter(s => !current.has(s.id) && isDefaultSelected(s, mode)).map(s => s.id),
    ]));
  }, [mode]);

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const setAll = (checked: boolean) =>
    setSelected(checked ? new Set(items.filter(isApplicable).map(s => s.id)) : new Set());

  const setAfter = (id: string, after: string) =>
    setItems(prev => prev.map(s => (s.id === id ? { ...s, after } : s)));

  const selectedItems = items.filter(s => selected.has(s.id) && isApplicable(s));
  return { items, selected, selectedItems, reset, extend, toggle, setAll, setAfter };
}

const SEVERITY_STYLES: Record<SuggestionSeverity, { badge: string; icon: React.ElementType }> = {
  error: { badge: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-200', icon: AlertCircle },
  warning: { badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200', icon: AlertTriangle },
  info: { badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200', icon: Info },
};

interface Props {
  items: DocSuggestion[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onEditAfter: (id: string, after: string) => void;
  checkItems?: string[];
  grounding?: GroundingInfo;
  emptyMessage?: string;
}

export const ReviewSuggestionTable: React.FC<Props> = ({
  items, selected, onToggle, onToggleAll, onEditAfter, checkItems = [], grounding, emptyMessage = '고칠 곳을 찾지 못했습니다.',
}) => {
  const counts = items.reduce<Record<SuggestionSeverity, number>>(
    (acc, s) => ({ ...acc, [s.severity]: acc[s.severity] + 1 }),
    { error: 0, warning: 0, info: 0 },
  );
  const applicable = items.filter(isApplicable);
  const allSelected = applicable.length > 0 && applicable.every(s => selected.has(s.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(SEVERITY_LABELS) as SuggestionSeverity[]).map(severity => (
          <span key={severity} className={`text-xs font-bold px-2.5 py-1 rounded-full ${SEVERITY_STYLES[severity].badge}`}>
            {SEVERITY_LABELS[severity]} {counts[severity]}
          </span>
        ))}
        {applicable.length > 0 && (
          <button
            type="button"
            onClick={() => onToggleAll(!allSelected)}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-[#57534E] dark:text-[#C4B8B0] hover:text-[#1C1917] dark:hover:text-white"
          >
            {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {allSelected ? '전체 해제' : '전체 선택'}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[#78716C] dark:text-[#9C8F87] py-6 text-center">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2">
          {items.map(s => {
            const style = SEVERITY_STYLES[s.severity];
            const Icon = style.icon;
            const canApply = isApplicable(s);
            const checked = selected.has(s.id);
            return (
              <li
                key={s.id}
                className={`rounded-xl border p-3 transition-colors ${checked
                  ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20'
                  : 'border-[#E7E5E4] bg-white dark:border-[#2E2822] dark:bg-[#1A1613]'}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canApply}
                    onChange={() => onToggle(s.id)}
                    aria-label="이 제안 반영"
                    className="mt-1 w-4 h-4 accent-emerald-600 shrink-0 disabled:opacity-30"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                        <Icon className="w-3 h-3" />
                        {SEVERITY_LABELS[s.severity]}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F5F5F4] text-[#57534E] dark:bg-[#2E2822] dark:text-[#C4B8B0]">{s.category}</span>
                      <span className="text-[11px] text-[#A8A29E]">{s.source === 'rule' ? '자동 계산' : 'AI'}</span>
                      {s.needsCheck && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-200">확인 필요</span>
                      )}
                    </div>
                    {s.before ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="rounded-lg bg-[#FAF9F7] dark:bg-[#221E1B] px-3 py-2">
                          <p className="text-[10px] font-bold text-[#A8A29E] mb-0.5">변경 전</p>
                          <p className="text-sm text-[#44403C] dark:text-[#C4B8B0] break-all line-through decoration-red-300/70">{s.before}</p>
                        </div>
                        {canApply ? (
                          <label className="block rounded-lg bg-[#FAF9F7] dark:bg-[#221E1B] px-3 py-2">
                            <span className="block text-[10px] font-bold text-[#A8A29E] mb-0.5">변경 후 (직접 고칠 수 있음)</span>
                            <input
                              value={s.after}
                              onChange={e => onEditAfter(s.id, e.target.value)}
                              className="w-full bg-transparent text-sm font-bold text-emerald-700 dark:text-emerald-300 focus:outline-none"
                            />
                          </label>
                        ) : (
                          <div className="rounded-lg border border-dashed border-[#D6D3D1] dark:border-[#3A332D] px-3 py-2 text-xs text-[#78716C] dark:text-[#9C8F87] flex items-center">
                            자동 수정 없음 · 원문에서 직접 확인해 주세요
                          </div>
                        )}
                      </div>
                    ) : null}
                    {s.reason && <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed break-keep">{s.reason}</p>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ReviewExtras checkItems={checkItems} grounding={grounding} />
    </div>
  );
};

// 검토 결과 아래에 붙는 「직접 확인할 사항」과 웹 검색 출처. 비교표와 본문 하이라이트 보기가 함께 쓴다.
export const ReviewExtras: React.FC<{ checkItems?: string[]; grounding?: GroundingInfo }> = ({ checkItems = [], grounding }) => (
  <>
      {checkItems.length > 0 && (
        <div className="rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/60 dark:bg-purple-950/20 p-3">
          <p className="text-sm font-bold text-purple-800 dark:text-purple-200 mb-1.5">직접 확인할 사항</p>
          <ul className="list-disc pl-5 space-y-1">
            {checkItems.map((item, i) => (
              <li key={i} className="text-xs text-[#44403C] dark:text-[#C4B8B0] leading-relaxed break-keep">{item}</li>
            ))}
          </ul>
        </div>
      )}

      {grounding && grounding.sources.length > 0 && (
        <div className="rounded-xl border border-[#E7E5E4] dark:border-[#2E2822] p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Globe className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">웹 검색 참조 자료</span>
          </div>
          <ol className="space-y-1">
            {grounding.sources.map((source, i) => (
              <li key={source.uri} className="text-xs">
                <span className="text-[#A8A29E] mr-1">{i + 1}.</span>
                <button
                  type="button"
                  onClick={() => window.electronAPI.openExternal(source.uri)}
                  className="text-left text-blue-600 dark:text-blue-300 hover:underline break-all"
                  title={source.uri}
                >
                  {source.title}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
  </>
);

export default ReviewSuggestionTable;
