import React from 'react';
import {
  ArrowRight, CalendarSync, ClipboardCopy, Copy, Download, FileText, Globe, Loader2, PanelLeftClose, PanelLeftOpen, Save, ScanSearch, ShieldCheck,
} from 'lucide-react';
import type { GroundingInfo } from '../../preload/types';
import { AppMode, FileData } from '../types';
import { FileUpload } from './FileUpload';
import { ReviewSuggestionTable, useSuggestionSelection } from './ReviewSuggestionTable';
import { InlineChangeView } from './InlineChangeView';
import { useGenerationTracker } from '../hooks/useGenerationTracker';
import { playSuccessSound } from '../lib/soundEffect';
import { notifyToast } from '../lib/toast';
import { copyPlainTextToClipboard } from '../lib/clipboard';
import { applySuggestions, changedFillNodes, DocSuggestion, formatSuggestionReport, mergeSuggestions, nodesToText } from '../lib/aiReview';
import { detectDocumentYear, DocKind, runDocRules, shiftDatesForSchoolYear } from '../lib/docRules';
import {
  describeDocSource, DOC_REVIEW_HANDOFF_EVENT, resolveDocSource, ResolvedDocSource, safeFileName, sendToDocReview, takeDocReviewHandoff,
} from '../lib/docSource';
import { fillHwpxTemplate } from '../lib/hwpx-parser';
import { refreshOfficialDocument, reviewDocument, type NodeReviewResult } from '../services/geminiService';

type Mode = 'refresh' | 'review';

// 현행화는 보통 새 학년도 준비 시기(11월~2월)에 다음 학년도로, 그 밖에는 올해 학년도로 맞춘다.
function defaultTargetYear(now = new Date()): number {
  const month = now.getMonth() + 1;
  const schoolYear = month < 3 ? now.getFullYear() - 1 : now.getFullYear();
  return month >= 11 || month <= 2 ? schoolYear + 1 : schoolYear;
}

const MODE_TEXT: Record<Mode, { title: string; subtitle: string; run: string; running: string; empty: string; icon: React.ElementType }> = {
  refresh: {
    title: '전년도 공문 현행화',
    subtitle: '작년 문서의 날짜·학년도를 올해로 바꾸고 변경사항을 반영합니다.',
    run: '현행화 제안 받기',
    running: '현행화 중...',
    empty: '작년 공문·계획서를 올리고 올해 변경사항을 적은 뒤 현행화 제안을 받으세요.',
    icon: CalendarSync,
  },
  review: {
    title: '공문·계획서 오류 검토',
    subtitle: '날짜·요일·금액·항목 번호와 오탈자·내용 모순을 찾아 고칩니다.',
    run: '오류 검토 시작',
    running: '검토 중...',
    empty: '검토할 파일을 올리거나 화면을 캡처해 붙여넣고(Ctrl+V), 또는 글을 붙여넣은 뒤 검토를 시작하세요.',
    icon: ScanSearch,
  },
};

const inputClass = 'w-full px-3 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#171210] text-sm text-[#1C1917] dark:text-[#F0EBE6] outline-none focus:ring-2 focus:ring-emerald-500';
const toolButtonClass = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] text-xs text-[#57534E] dark:text-[#C4B8B0] disabled:opacity-40 hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420] whitespace-nowrap';

const DocCheckScreen: React.FC<{ mode: Mode }> = ({ mode }) => {
  const text = MODE_TEXT[mode];
  const { startGeneration, endGeneration } = useGenerationTracker(mode === 'refresh' ? AppMode.DOC_REFRESH : AppMode.DOC_REVIEW);
  const [files, setFiles] = React.useState<FileData[]>([]);
  const [pastedText, setPastedText] = React.useState('');
  const [docKind, setDocKind] = React.useState<DocKind>('공문');
  const [targetYear, setTargetYear] = React.useState(defaultTargetYear);
  const [baseYear, setBaseYear] = React.useState(() => defaultTargetYear() - 1);
  const [changeNotes, setChangeNotes] = React.useState('');
  const [withWebSearch, setWithWebSearch] = React.useState(false);
  const [inputPanelCollapsed, setInputPanelCollapsed] = React.useState(false);

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [aiError, setAiError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [source, setSource] = React.useState<ResolvedDocSource | null>(null);
  const [nodes, setNodes] = React.useState<string[]>([]);
  const [aiResult, setAiResult] = React.useState<{ checkItems: string[]; grounding?: GroundingInfo; model: string } | null>(null);
  const selection = useSuggestionSelection(mode);
  const runIdRef = React.useRef(0);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = () => setIsLoading(false);
    window.addEventListener('edunote-generation-reset', handler);
    return () => window.removeEventListener('edunote-generation-reset', handler);
  }, []);

  // 현행화 화면에서 「오류 검토로 보내기」를 누르면 결과 문서를 받아 온다.
  React.useEffect(() => {
    if (mode !== 'review') return;
    const receive = () => {
      const payload = takeDocReviewHandoff();
      if (!payload) return;
      setFiles(payload.files);
      setPastedText(payload.text);
      setSource(null);
      selection.reset([]);
      setAiResult(null);
      setError('');
      notifyToast({ type: 'info', title: '현행화한 문서를 불러왔습니다.', description: '「오류 검토 시작」을 눌러 검토하세요.' });
    };
    receive();
    window.addEventListener(DOC_REVIEW_HANDOFF_EVENT, receive);
    return () => window.removeEventListener(DOC_REVIEW_HANDOFF_EVENT, receive);
    // selection.reset은 mode에만 의존하므로 mode가 바뀔 때만 다시 등록한다
  }, [mode]);

  const sourceHint = describeDocSource(files, pastedText);
  const canRun = (files.length > 0 || pastedText.trim() !== '') && !isLoading
    && (mode === 'review' || (baseYear >= 2000 && targetYear >= 2000));

  const runRules = (docNodes: string[]): DocSuggestion[] => (mode === 'refresh'
    ? shiftDatesForSchoolYear(docNodes, baseYear, targetYear)
    : runDocRules(docNodes, { docKind }));

  const handleRun = async () => {
    if (!canRun) return;
    const runId = ++runIdRef.current;
    setIsLoading(true);
    setError('');
    setAiError('');
    setNotice('');
    setAiResult(null);
    selection.reset([]);
    startGeneration();
    // 좁은 창에서는 입력 아래에 결과가 쌓이므로 결과 위치로 내려 준다
    if (window.innerWidth < 1024) requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    try {
      const resolved = await resolveDocSource(files, pastedText);
      setSource(resolved);
      setNodes(resolved.nodes);
      const notices = [resolved.notice];
      if (mode === 'refresh' && resolved.nodes.length > 0) {
        const detected = detectDocumentYear(resolved.nodes);
        if (detected && detected !== baseYear && detected !== baseYear + 1) {
          notices.push(`문서에는 ${detected}년이 가장 많이 보입니다. 기준 학년도(${baseYear})가 맞는지 확인해 주세요.`);
        }
      }
      setNotice(notices.filter(Boolean).join(' '));

      // 1) 규칙 검사 — 글자를 알고 있으면 AI를 기다리지 않고 먼저 보여 준다
      const rules = resolved.nodes.length > 0 ? runRules(resolved.nodes) : [];
      selection.reset(rules);

      // 2) AI 검토 — 실패해도 규칙 검사 결과는 남긴다
      let ai: NodeReviewResult | null = null;
      try {
        ai = mode === 'refresh'
          ? await refreshOfficialDocument({
            nodes: resolved.nodes, files: resolved.files, baseYear, targetYear, changeNotes, ruleFindings: rules, useSearchGrounding: withWebSearch,
          })
          : await reviewDocument({
            nodes: resolved.nodes, files: resolved.files, docKind, ruleFindings: rules, useSearchGrounding: withWebSearch,
          });
      } catch (err) {
        if (runId !== runIdRef.current) return;
        if (resolved.kind === 'files') throw err;
        const message = err instanceof Error ? err.message : 'AI 검토 중 오류가 발생했습니다.';
        setAiError(withWebSearch ? `${message} (웹 검색을 끄고 다시 시도해 보세요.)` : message);
      }
      if (runId !== runIdRef.current || !ai) return;

      if (ai.transcribed) {
        // 이미지·PDF는 AI가 옮겨 적은 글자로 규칙 검사를 다시 한다
        setNodes(ai.nodes);
        selection.reset(mergeSuggestions(runRules(ai.nodes), ai.suggestions));
      } else {
        selection.extend(mergeSuggestions(rules, ai.suggestions));
      }
      setAiResult({ checkItems: ai.checkItems, grounding: ai.grounding, model: ai.model });
      playSuccessSound();
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(err instanceof Error ? err.message : '문서를 처리하지 못했습니다.');
    } finally {
      if (runId === runIdRef.current) {
        setIsLoading(false);
        endGeneration();
      }
    }
  };

  const buildUpdated = () => {
    const result = applySuggestions(nodes, selection.selectedItems);
    if (result.failed.length > 0) {
      notifyToast({ type: 'warning', title: `${result.failed.length}건은 다른 제안과 겹쳐 반영하지 못했습니다.` });
    }
    return result.nodes;
  };

  const outputName = () => safeFileName(
    `${source?.fileName ?? '문서'}_${mode === 'refresh' ? `${targetYear}학년도` : '검토반영'}`,
    mode === 'refresh' ? '현행화_문서' : '검토_문서',
  );

  const buildFilledHwpx = async (): Promise<Blob | null> => {
    if (!source?.hwpxFile) return null;
    return fillHwpxTemplate(source.hwpxFile, changedFillNodes(nodes, buildUpdated()));
  };

  const handleSaveHwpx = async () => {
    try {
      const blob = await buildFilledHwpx();
      if (!blob) return;
      await window.electronAPI.saveBuffer(await blob.arrayBuffer(), `${outputName()}.hwpx`);
    } catch (err) {
      console.error('Failed to save refreshed HWPX', err);
      notifyToast({ type: 'error', title: 'HWPX 저장 중 오류가 발생했습니다.' });
    }
  };

  const handleCopyUpdated = async () => {
    const copied = await copyPlainTextToClipboard(nodesToText(buildUpdated()));
    notifyToast(copied ? { type: 'success', title: '고친 문서를 복사했습니다.' } : { type: 'error', title: '클립보드 복사에 실패했습니다.' });
  };

  const handleSaveTxt = async () => {
    await window.electronAPI.saveTxt(nodesToText(buildUpdated()), `${outputName()}.txt`);
  };

  const handleCopyReport = async () => {
    const report = [
      formatSuggestionReport(selection.items),
      ...(aiResult?.checkItems.length ? ['', '[직접 확인할 사항]', ...aiResult.checkItems.map(item => `- ${item}`)] : []),
    ].join('\n');
    const copied = await copyPlainTextToClipboard(report);
    notifyToast(copied ? { type: 'success', title: mode === 'refresh' ? '변경 목록을 복사했습니다.' : '비교표를 복사했습니다.' } : { type: 'error', title: '클립보드 복사에 실패했습니다.' });
  };

  const handleSendToReview = async () => {
    try {
      if (source?.kind === 'hwpx') {
        const blob = await buildFilledHwpx();
        if (!blob) return;
        const file = new File([blob], `${outputName()}.hwpx`, { type: 'application/hwp+zip' });
        sendToDocReview({ files: [{ file, base64: '', mimeType: 'application/hwp+zip' }], text: '' });
      } else {
        sendToDocReview({ files: [], text: nodesToText(buildUpdated()) });
      }
    } catch (err) {
      console.error('Failed to hand off refreshed document', err);
      notifyToast({ type: 'error', title: '문서를 넘기지 못했습니다.' });
    }
  };

  const hasResult = source !== null && (selection.items.length > 0 || aiResult !== null);
  const Icon = text.icon;

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 bg-[#FAF9F7] dark:bg-[#171210] overflow-y-auto lg:overflow-hidden">
      {inputPanelCollapsed && (
        <div className="hidden lg:flex w-11 shrink-0 border-r border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] justify-center py-3">
          <button onClick={() => setInputPanelCollapsed(false)} className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-[#78716C] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]" title="입력 패널 펼치기">
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className={`${inputPanelCollapsed ? 'lg:hidden' : ''} w-full lg:w-[390px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] flex flex-col lg:min-h-0`}>
        <div className="min-h-14 px-4 py-2 border-b border-[#EDE8E1] dark:border-[#2E2822] flex items-center gap-2">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-[#1C1917] dark:text-[#F0EBE6]">{text.title}</h2>
            <p className="text-xs text-[#78716C] dark:text-[#9C8F87] break-keep">{text.subtitle}</p>
          </div>
          <button onClick={() => setInputPanelCollapsed(true)} className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-[#78716C] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]" title="입력 패널 접기">
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        <div className="lg:flex-1 lg:overflow-y-auto p-5 space-y-5">
          <FileUpload
            label={mode === 'refresh' ? '작년 공문·계획서 (HWPX 권장 · PDF·캡처 가능)' : '검토할 파일 업로드 또는 스크린샷 붙여넣기'}
            files={files}
            onFilesChange={setFiles}
            multiple={mode === 'review'}
            maxFiles={mode === 'review' ? 5 : 1}
          />

          <div>
            <label className="block text-xs font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">또는 글 붙여넣기</label>
            <textarea
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              className={`${inputClass} min-h-[120px] resize-y`}
              placeholder="문서 내용을 그대로 붙여넣으세요. HWPX 파일을 올렸다면 비워 두세요."
            />
          </div>

          {sourceHint && (
            <p className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2 break-keep">검토 대상: {sourceHint}</p>
          )}

          {mode === 'refresh' ? (
            <>
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <label className="block">
                  <span className="block text-xs font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">기준(작년) 학년도</span>
                  <input type="number" min={2000} max={2100} value={baseYear} onChange={e => setBaseYear(Number(e.target.value))} className={inputClass} />
                </label>
                <ArrowRight className="w-4 h-4 mb-2.5 text-[#A8A29E]" />
                <label className="block">
                  <span className="block text-xs font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">목표(올해) 학년도</span>
                  <input type="number" min={2000} max={2100} value={targetYear} onChange={e => setTargetYear(Number(e.target.value))} className={inputClass} />
                </label>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">올해 바뀐 내용 (선택)</label>
                <textarea
                  value={changeNotes}
                  onChange={e => setChangeNotes(e.target.value)}
                  className={`${inputClass} min-h-[96px] resize-y`}
                  placeholder={'예)\n- 운영 기간 4주 → 6주\n- 예산 200만원 → 250만원\n- 담당 부서: 교무부 → 교육과정부'}
                />
              </div>
            </>
          ) : (
            <div>
              <span className="block text-xs font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">문서 종류</span>
              <div className="grid grid-cols-3 gap-2">
                {(['공문', '계획서', '기타'] as DocKind[]).map(kind => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setDocKind(kind)}
                    className={`py-2 rounded-lg border text-sm font-bold transition-colors ${docKind === kind
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-[#E7E5E4] dark:border-[#2E2822] text-[#57534E] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]'}`}
                  >
                    {kind}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={withWebSearch} onChange={e => setWithWebSearch(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-600" />
            <span className="text-sm text-[#44403C] dark:text-[#C4B8B0]">
              <span className="font-bold inline-flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> 법령·지침 변경 웹 검색</span>
              <span className="block text-xs text-[#78716C] dark:text-[#9C8F87] break-keep">문서가 근거로 든 법령·지침이 바뀌었는지 찾아 「확인 필요」로 표시합니다. 시간이 더 걸립니다.</span>
            </span>
          </label>

          <p className="flex items-start gap-1.5 text-xs text-[#78716C] dark:text-[#9C8F87] break-keep">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600" />
            글자로 읽을 수 있는 문서의 주민등록번호·휴대전화 번호는 AI로 보내기 전에 가립니다. 캡처 이미지는 가릴 수 없으니 개인정보가 보이지 않게 캡처해 주세요.
          </p>

          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-200">{error}</div>
          )}
        </div>

        <div className="p-5 border-t border-[#EDE8E1] dark:border-[#2E2822]">
          <button
            onClick={handleRun}
            disabled={!canRun}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-[#E7E5E4] dark:disabled:bg-[#2E2822] text-white font-bold transition-colors"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
            {isLoading ? text.running : text.run}
          </button>
        </div>
      </div>

      <div ref={resultsRef} className="flex-1 flex flex-col min-w-0 lg:min-h-0">
        <div className="min-h-14 px-4 py-2 border-b border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] flex flex-wrap items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-bold text-[#1C1917] dark:text-[#F0EBE6] mr-auto">
            {mode === 'refresh' ? '현행화 제안' : '검토 결과'}
            {hasResult && <span className="ml-2 text-xs font-medium text-[#78716C]">선택 {selection.selectedItems.length}건</span>}
          </span>
          {aiResult?.model && (
            <span className="text-[10px] text-[#A8A29E] bg-[#EDE8E1] dark:bg-[#2E2822] px-2 py-0.5 rounded-full font-medium" title="이 결과를 만든 AI 모델">{aiResult.model}</span>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {source?.kind === 'hwpx' ? (
              <button onClick={handleSaveHwpx} disabled={!hasResult} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-xs font-bold text-white whitespace-nowrap" title="원본 HWPX의 표·서식은 그대로 두고, 체크한 글자만 바꿔 저장합니다">
                <Download className="w-3.5 h-3.5" /> HWPX 저장 (서식 유지)
              </button>
            ) : (
              <>
                <button onClick={handleCopyUpdated} disabled={!hasResult} className={toolButtonClass}><Copy className="w-3.5 h-3.5" /> 고친 문서 복사</button>
                <button onClick={handleSaveTxt} disabled={!hasResult} className={toolButtonClass}><Save className="w-3.5 h-3.5" /> TXT 저장</button>
              </>
            )}
            <button onClick={handleCopyReport} disabled={!hasResult} className={toolButtonClass}><ClipboardCopy className="w-3.5 h-3.5" /> {mode === 'refresh' ? '변경 목록 복사' : '비교표 복사'}</button>
            {mode === 'refresh' && (
              <button onClick={handleSendToReview} disabled={!hasResult} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-200 dark:border-violet-800 text-xs font-bold text-violet-700 dark:text-violet-300 disabled:opacity-40 hover:bg-violet-50 dark:hover:bg-violet-950/30 whitespace-nowrap" title="체크한 내용을 반영한 문서를 오류 검토 화면으로 보냅니다">
                <ScanSearch className="w-3.5 h-3.5" /> 오류 검토로 보내기
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 lg:overflow-y-auto p-4 sm:p-6">
          {source ? (
            <div className="max-w-4xl mx-auto space-y-3">
              {source.kind === 'files' && nodes.length > 0 && (
                <p className="text-xs text-[#78716C] dark:text-[#9C8F87] bg-white dark:bg-[#221E1B] border border-[#EDE8E1] dark:border-[#2E2822] rounded-lg px-3 py-2 break-keep">
                  AI가 이미지·PDF에서 읽은 글자로 검토했습니다. 원본 파일은 고칠 수 없으니 「고친 문서 복사」로 내용을 옮겨 쓰세요.
                </p>
              )}
              {notice && (
                <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 break-keep">{notice}</p>
              )}
              {isLoading && (
                <div className="flex items-center gap-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 px-3 py-2 text-sm text-violet-700 dark:text-violet-200">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {mode === 'refresh' ? '날짜 변경은 먼저 보여 드리고, AI가 변경사항을 반영하는 중입니다...' : '자동 계산 결과를 먼저 보여 드리고, AI가 오탈자·모순을 찾는 중입니다...'}
                </div>
              )}
              {aiError && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                  AI 검토를 마치지 못해 자동 계산 결과만 보여 드립니다. ({aiError})
                </div>
              )}
              {mode === 'refresh' ? (
                // 현행화는 비교표 대신 본문 그대로 보여 주고 바뀌는 곳을 하이라이트한다
                <InlineChangeView
                  nodes={nodes}
                  paragraphOf={source.kind === 'hwpx' ? source.paragraphOf : undefined}
                  items={selection.items}
                  selected={selection.selected}
                  onToggle={selection.toggle}
                  onToggleAll={selection.setAll}
                  onEditAfter={selection.setAfter}
                  checkItems={aiResult?.checkItems}
                  grounding={aiResult?.grounding}
                  emptyMessage={isLoading ? '처리 중입니다...' : '문서 내용을 읽지 못했습니다.'}
                />
              ) : (
                <ReviewSuggestionTable
                  items={selection.items}
                  selected={selection.selected}
                  onToggle={selection.toggle}
                  onToggleAll={selection.setAll}
                  onEditAfter={selection.setAfter}
                  checkItems={aiResult?.checkItems}
                  grounding={aiResult?.grounding}
                  emptyMessage={isLoading ? '처리 중입니다...' : '고칠 곳을 찾지 못했습니다.'}
                />
              )}
              {mode === 'refresh' && !isLoading && selection.items.length === 0 && (
                <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 break-keep">바꿀 곳을 찾지 못했습니다. 기준 학년도가 맞는지 확인해 주세요.</p>
              )}
              <p className="text-xs text-[#A8A29E] break-keep">
                {mode === 'refresh'
                  ? 'AI 제안은 틀릴 수 있습니다. 초록색으로 바뀐 곳만 저장·복사하는 문서에 반영됩니다. 하이라이트를 누르면 이유를 보고 반영 여부를 바꿀 수 있습니다.'
                  : 'AI 제안은 틀릴 수 있습니다. 체크한 항목만 저장·복사하는 문서에 반영됩니다.'}
              </p>
            </div>
          ) : (
            <div className="h-full min-h-[240px] flex items-center justify-center text-center text-[#A8A29E] dark:text-[#6B5E57]">
              <div className="max-w-sm">
                <Icon className="w-10 h-10 mx-auto mb-3 opacity-60" />
                <p className="text-sm font-semibold break-keep">{text.empty}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocCheckScreen;
