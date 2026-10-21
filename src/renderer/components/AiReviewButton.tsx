import React from 'react';
import { Loader2, ScanSearch, X } from 'lucide-react';
import { applySuggestions, DocSuggestion, mergeSuggestions } from '../lib/aiReview';
import { DocKind, runDocRules } from '../lib/docRules';
import { runRecordRules } from '../lib/recordRules';
import { getRosterGenerationExtras } from '../lib/generationSafety';
import type { RecordKind } from '../lib/textLength';
import { notifyToast } from '../lib/toast';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { reviewDocument, reviewStudentRecord, type NodeReviewResult } from '../services/geminiService';
import { ReviewSuggestionTable, useSuggestionSelection } from './ReviewSuggestionTable';

// 검토 시점의 문서 노드와, 고친 노드를 화면에 되돌려 쓰는 방법.
export interface ReviewSnapshot {
  nodes: string[];
  /** 고친 노드를 반영한다. 반영하지 못한 노드 수를 돌려주면 안내에 함께 표시한다 */
  commit: (updated: string[]) => { skipped?: number } | undefined;
}

type Props = {
  getSnapshot: () => ReviewSnapshot | null;
  disabled?: boolean;
  className?: string;
} & (
  | { target: 'document'; docKind?: DocKind }
  | { target: 'record'; recordKind: RecordKind; studentName?: string; sourceNotes?: string; byteLimit?: number }
);

// 결과 화면(학교문서 작성·학생기록)에 붙는 「AI 오류 검토」 버튼.
// 규칙 검사 결과는 바로 보여 주고, AI 검토가 끝나면 합쳐서 보여 준다.
// 교사가 체크한 제안만 결과에 반영한다.
export const AiReviewButton: React.FC<Props> = (props) => {
  const { getSnapshot, disabled, className } = props;
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [aiError, setAiError] = React.useState('');
  const [result, setResult] = React.useState<Pick<NodeReviewResult, 'checkItems' | 'grounding' | 'model'> | null>(null);
  const snapshotRef = React.useRef<ReviewSnapshot | null>(null);
  const runIdRef = React.useRef(0);
  const selection = useSuggestionSelection('review');

  const close = React.useCallback(() => {
    runIdRef.current += 1;
    setOpen(false);
    setLoading(false);
  }, []);
  useEscapeKey(open, close);

  const handleReview = async () => {
    const snapshot = getSnapshot();
    if (!snapshot || !snapshot.nodes.some(node => node.trim())) {
      notifyToast({ type: 'warning', title: '검토할 내용이 없습니다.' });
      return;
    }
    const runId = ++runIdRef.current;
    snapshotRef.current = snapshot;
    setOpen(true);
    setAiError('');
    setResult(null);
    setLoading(true);

    let rules: DocSuggestion[] = [];
    let ai: NodeReviewResult | null = null;
    try {
      if (props.target === 'record') {
        const extras = await getRosterGenerationExtras();
        rules = runRecordRules(snapshot.nodes, {
          byteLimit: props.byteLimit,
          studentName: props.studentName,
          rosterNames: extras.rosterNames,
        });
        selection.reset(rules);
        ai = await reviewStudentRecord({
          text: snapshot.nodes.join('\n'),
          recordKind: props.recordKind,
          studentName: props.studentName ?? '',
          sourceNotes: props.sourceNotes ?? '',
          ruleFindings: rules,
          privacyModeEnabled: extras.privacyModeEnabled,
          rosterNames: extras.rosterNames,
        });
      } else {
        const docKind = props.docKind ?? '기타';
        rules = runDocRules(snapshot.nodes, { docKind });
        selection.reset(rules);
        ai = await reviewDocument({ nodes: snapshot.nodes, files: [], docKind, ruleFindings: rules });
      }
    } catch (error) {
      if (runId !== runIdRef.current) return;
      setAiError(error instanceof Error ? error.message : 'AI 검토 중 오류가 발생했습니다.');
    }
    if (runId !== runIdRef.current) return;
    if (ai) selection.extend(mergeSuggestions(rules, ai.suggestions));
    if (ai) setResult({ checkItems: ai.checkItems, grounding: ai.grounding, model: ai.model });
    setLoading(false);
  };

  const handleApply = () => {
    const snapshot = snapshotRef.current;
    if (!snapshot || selection.selectedItems.length === 0) return;
    const applied = applySuggestions(snapshot.nodes, selection.selectedItems);
    const skipped = snapshot.commit(applied.nodes)?.skipped ?? 0;
    const missed = applied.failed.length + skipped;
    notifyToast({
      type: missed > 0 ? 'warning' : 'success',
      title: `${applied.applied.length}건을 반영했습니다.`,
      description: missed > 0 ? `${missed}건은 그사이 내용이 바뀌었거나 다른 제안과 겹쳐 반영하지 못했습니다.` : undefined,
    });
    close();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleReview}
        disabled={disabled || loading}
        className={className ?? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-xs font-bold text-white'}
        title="날짜·요일·금액·기재요령 같은 규칙을 먼저 계산하고, AI가 오탈자·모순·과장을 찾아 고칠 곳을 제안합니다"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />}
        AI 오류 검토
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="AI 오류 검토 결과"
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-[#221E1B] w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col"
          >
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[#EDE8E1] dark:border-[#2E2822]">
              <ScanSearch className="w-5 h-5 text-violet-600" />
              <h2 className="text-base font-bold text-[#1C1917] dark:text-[#F0EBE6]">AI 오류 검토</h2>
              {result?.model && (
                <span className="text-[10px] text-[#A8A29E] bg-[#EDE8E1] dark:bg-[#2E2822] px-2 py-0.5 rounded-full">{result.model}</span>
              )}
              <button type="button" onClick={close} className="ml-auto p-1.5 rounded-lg hover:bg-[#F5F5F4] dark:hover:bg-[#2E2822]" aria-label="닫기">
                <X className="w-4 h-4 text-[#78716C]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {loading && (
                <div className="flex items-center gap-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 px-3 py-2 text-sm text-violet-700 dark:text-violet-200">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  자동 계산 결과를 먼저 보여 드리고, AI가 오탈자·모순을 찾는 중입니다...
                </div>
              )}
              {aiError && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                  AI 검토를 마치지 못해 자동 계산 결과만 보여 드립니다. ({aiError})
                </div>
              )}
              <ReviewSuggestionTable
                items={selection.items}
                selected={selection.selected}
                onToggle={selection.toggle}
                onToggleAll={selection.setAll}
                onEditAfter={selection.setAfter}
                checkItems={result?.checkItems}
                grounding={result?.grounding}
                emptyMessage={loading ? '검토 중입니다...' : '고칠 곳을 찾지 못했습니다.'}
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 px-5 py-4 border-t border-[#EDE8E1] dark:border-[#2E2822]">
              <p className="text-xs text-[#A8A29E] sm:mr-auto break-keep">AI 제안은 틀릴 수 있습니다. 체크한 항목만 결과에 반영됩니다.</p>
              <button type="button" onClick={close} className="px-4 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">
                닫기
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={selection.selectedItems.length === 0}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-[#E7E5E4] dark:disabled:bg-[#2E2822] text-sm font-bold text-white"
              >
                선택한 {selection.selectedItems.length}건 반영
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AiReviewButton;
