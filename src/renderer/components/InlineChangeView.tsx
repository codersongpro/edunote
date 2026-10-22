import React from 'react';
import { CheckSquare, Square, X } from 'lucide-react';
import type { GroundingInfo } from '../../preload/types';
import { DocSuggestion, SEVERITY_LABELS, isApplicable } from '../lib/aiReview';
import { layoutInlineChanges } from '../lib/inlineChanges';
import { ReviewExtras } from './ReviewSuggestionTable';

interface Props {
  nodes: string[];
  paragraphOf?: number[];
  items: DocSuggestion[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onEditAfter: (id: string, after: string) => void;
  checkItems?: string[];
  grounding?: GroundingInfo;
  emptyMessage?: string;
}

// 하이라이트 색: 반영(초록 새 글자 + 빨간 취소선), 제안(노랑), 확인 필요(보라), 안내만(하늘)
function markClass(s: DocSuggestion, checked: boolean, active: boolean): string {
  const ring = active ? ' ring-2 ring-offset-1 ring-violet-500 dark:ring-offset-[#221E1B]' : '';
  if (!isApplicable(s)) return `rounded px-0.5 bg-sky-100 dark:bg-sky-900/40 underline decoration-dotted decoration-sky-500${ring}`;
  if (checked) return `rounded px-0.5 bg-emerald-50 dark:bg-emerald-950/40${ring}`;
  if (s.needsCheck) return `rounded px-0.5 bg-purple-100 dark:bg-purple-900/40 underline decoration-dotted decoration-purple-500${ring}`;
  return `rounded px-0.5 bg-amber-100 dark:bg-amber-900/40 underline decoration-dotted decoration-amber-500${ring}`;
}

const SuggestionCard: React.FC<{
  s: DocSuggestion;
  checked: boolean;
  onToggle: () => void;
  onEditAfter: (after: string) => void;
  onClose?: () => void;
}> = ({ s, checked, onToggle, onEditAfter, onClose }) => (
  <div className="my-2 rounded-xl border border-violet-200 dark:border-violet-900 bg-white dark:bg-[#1A1613] p-3 shadow-sm space-y-2 text-left whitespace-normal">
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F5F5F4] text-[#57534E] dark:bg-[#2E2822] dark:text-[#C4B8B0]">{s.category}</span>
      <span className="text-[11px] text-[#A8A29E]">{SEVERITY_LABELS[s.severity]} · {s.source === 'rule' ? '자동 계산' : 'AI'}</span>
      {s.needsCheck && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-200">확인 필요</span>}
      {onClose && (
        <button type="button" onClick={onClose} className="ml-auto p-1 rounded hover:bg-[#F5F5F4] dark:hover:bg-[#2E2822]" aria-label="닫기">
          <X className="w-3.5 h-3.5 text-[#78716C]" />
        </button>
      )}
    </div>
    {s.reason && <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed break-keep">{s.reason}</p>}
    {isApplicable(s) ? (
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <label className="flex-1 flex items-center gap-2 rounded-lg bg-[#FAF9F7] dark:bg-[#221E1B] px-3 py-1.5">
          <span className="text-[10px] font-bold text-[#A8A29E] shrink-0">바꿀 글자</span>
          <input
            value={s.after}
            onChange={e => onEditAfter(e.target.value)}
            className="w-full bg-transparent text-sm font-bold text-emerald-700 dark:text-emerald-300 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={onToggle}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${checked
            ? 'border border-[#E7E5E4] dark:border-[#2E2822] text-[#57534E] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
        >
          {checked ? '원래대로 두기' : '이대로 바꾸기'}
        </button>
      </div>
    ) : (
      <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">자동으로 바꾸지 않습니다. 원문에서 직접 확인해 주세요.</p>
    )}
  </div>
);

// 현행화 결과를 본문 그대로 보여 주고, 바뀌는 곳을 하이라이트한다.
// 하이라이트를 누르면 바로 아래에 이유와 바꿀 글자가 펼쳐지고, 반영 여부를 고를 수 있다.
export const InlineChangeView: React.FC<Props> = ({
  nodes, paragraphOf, items, selected, onToggle, onToggleAll, onEditAfter, checkItems, grounding, emptyMessage = '바꿀 곳을 찾지 못했습니다.',
}) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const layout = React.useMemo(() => layoutInlineChanges(nodes, paragraphOf, items), [nodes, paragraphOf, items]);
  const applicable = items.filter(isApplicable);
  const selectedCount = applicable.filter(s => selected.has(s.id)).length;
  const allSelected = applicable.length > 0 && selectedCount === applicable.length;
  const byId = new Map(items.map(s => [s.id, s]));
  const active = activeId ? byId.get(activeId) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[#57534E] dark:text-[#C4B8B0]">
        <span className="font-bold text-sm text-[#1C1917] dark:text-[#F0EBE6]">바뀌는 곳 {items.length}곳 · 반영 {selectedCount}곳</span>
        <span className="inline-flex items-center gap-1"><span className="px-1 rounded bg-emerald-50 dark:bg-emerald-950/40"><del className="text-red-500">전</del> <ins className="no-underline font-bold text-emerald-700 dark:text-emerald-300">후</ins></span> 반영</span>
        <span className="inline-flex items-center gap-1"><span className="px-1.5 rounded bg-amber-100 dark:bg-amber-900/40 underline decoration-dotted">제안</span> 누르면 반영</span>
        <span className="inline-flex items-center gap-1"><span className="px-1.5 rounded bg-purple-100 dark:bg-purple-900/40 underline decoration-dotted">확인 필요</span></span>
        {applicable.length > 0 && (
          <button type="button" onClick={() => onToggleAll(!allSelected)} className="ml-auto inline-flex items-center gap-1.5 font-bold hover:text-[#1C1917] dark:hover:text-white">
            {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {allSelected ? '모두 원래대로' : '모두 반영'}
          </button>
        )}
      </div>

      {layout.unplaced.length > 0 && (
        <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/20 p-3 space-y-1">
          <p className="text-sm font-bold text-sky-800 dark:text-sky-200">문서 전체 안내</p>
          {layout.unplaced.map(s => (
            <SuggestionCard key={s.id} s={s} checked={selected.has(s.id)} onToggle={() => onToggle(s.id)} onEditAfter={after => onEditAfter(s.id, after)} />
          ))}
        </div>
      )}

      <article className="bg-white dark:bg-[#1A1613] border border-[#E7E5E4] dark:border-[#2E2822] rounded-2xl shadow-sm px-5 py-6 sm:px-10 sm:py-10 text-[15px] leading-8 text-[#1C1917] dark:text-[#E7E0D8] break-keep">
        {layout.paragraphs.length === 0 && <p className="text-sm text-[#78716C] text-center">{emptyMessage}</p>}
        {layout.paragraphs.map(paragraph => {
          const activeHere = active && paragraph.pieces.some(piece => piece.suggestion?.id === active.id);
          return (
            <div key={paragraph.key} className="whitespace-pre-wrap min-h-[1em]">
              {paragraph.pieces.map((piece, i) => {
                const s = piece.suggestion;
                if (!s) return <React.Fragment key={i}>{piece.text}</React.Fragment>;
                const checked = selected.has(s.id) && isApplicable(s);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveId(activeId === s.id ? null : s.id)}
                    aria-pressed={checked}
                    title={`${s.category}: ${s.reason}`}
                    className={markClass(s, checked, activeId === s.id)}
                  >
                    {checked ? (
                      <>
                        <del className="text-red-500/80 decoration-red-400">{s.before}</del>
                        <ins className="no-underline font-bold text-emerald-700 dark:text-emerald-300">{s.after}</ins>
                      </>
                    ) : s.before}
                  </button>
                );
              })}
              {activeHere && active && (
                <SuggestionCard
                  s={active}
                  checked={selected.has(active.id)}
                  onToggle={() => onToggle(active.id)}
                  onEditAfter={after => onEditAfter(active.id, after)}
                  onClose={() => setActiveId(null)}
                />
              )}
            </div>
          );
        })}
      </article>

      <ReviewExtras checkItems={checkItems} grounding={grounding} />
    </div>
  );
};

export default InlineChangeView;
