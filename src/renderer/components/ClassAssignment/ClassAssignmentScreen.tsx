import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ChevronUp, Download, FileSpreadsheet, GripVertical,
  Info, Lightbulb, Loader2, RefreshCw, Settings2, ShieldCheck, Trash2, Upload, Users, Wand2, XCircle,
} from 'lucide-react';
import { notifyToast } from '../../lib/toast';
import { CRITERION_META, classLabel, criterionLabel, defaultConfig } from '../../lib/classAssignment/criteria';
import { suggestSwaps } from '../../lib/classAssignment/engine';
import { buildResultWorkbook, buildTemplateWorkbook } from '../../lib/classAssignment/export';
import { computeClassStats, evaluateCompliance, isolationThresholds } from '../../lib/classAssignment/metrics';
import { parseRosterFile } from '../../lib/classAssignment/parse';
import { resolveRelations } from '../../lib/classAssignment/relations';
import { runRefine, runScenarios } from '../../lib/classAssignment/runner';
import { clearWork, loadWork, saveWork } from '../../lib/classAssignment/storage';
import type {
  Assignment, AssignmentConfig, ClassStudent, CriterionSetting, Diagnostic, Scenario, SoftCriterionId,
} from '../../lib/classAssignment/types';
import ClassCard from './ClassCard';
import TransitionMatrix from './TransitionMatrix';
import { isWeb } from '../../lib/platform';
import { btnDanger, btnPrimary, btnSecondary, card, input, muted, statusStyle, strong } from './ui';

// 반편성 — 학년말 다음 학년도 반 배정
// AI를 쓰지 않는 규칙 기반 최적화이며, 학생 정보는 이 PC 밖으로 나가지 않는다.

type Step = 'upload' | 'setup' | 'result';

const DiagnosticList: React.FC<{ items: Diagnostic[] }> = ({ items }) => {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const errors = items.filter(d => d.level === 'error').length;
  const warns = items.filter(d => d.level === 'warning').length;
  const shown = open ? items : items.slice(0, 4);
  return (
    <div className={`${card} p-4 space-y-2`}>
      <div className="flex items-center gap-2 text-sm font-bold">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <span className={strong}>명단 점검 결과</span>
        <span className={`text-xs font-normal ${muted}`}>오류 {errors} · 주의 {warns} · 안내 {items.length - errors - warns}</span>
      </div>
      <ul className="space-y-1">
        {shown.map((d, i) => (
          <li key={i} className="flex gap-2 text-xs leading-relaxed">
            {d.level === 'error' ? <XCircle className="w-3.5 h-3.5 mt-0.5 text-red-500 shrink-0" />
              : d.level === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />
                : <Info className="w-3.5 h-3.5 mt-0.5 text-sky-500 shrink-0" />}
            <span className="text-[#44403C] dark:text-[#C4B8B0]">{d.message}</span>
          </li>
        ))}
      </ul>
      {items.length > 4 && (
        <button type="button" onClick={() => setOpen(!open)} className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
          {open ? '접기' : `${items.length - 4}건 더 보기`}
        </button>
      )}
    </div>
  );
};

const ClassAssignmentScreen: React.FC = () => {
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseDiagnostics, setParseDiagnostics] = useState<Diagnostic[]>([]);
  const [extraColumns, setExtraColumns] = useState<string[]>([]);
  const [config, setConfig] = useState<AssignmentConfig>(() => defaultConfig());
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [working, setWorking] = useState<Assignment[]>([]);
  const [active, setActive] = useState(0);
  const [locks, setLocks] = useState<Assignment>({});
  const [autoLock, setAutoLock] = useState(true);
  const [step, setStep] = useState<Step>('upload');
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showMatrix, setShowMatrix] = useState(true);
  const [restored, setRestored] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---------- 저장·복원 ----------
  useEffect(() => {
    let alive = true;
    void loadWork().then(work => {
      if (!alive) return;
      if (work && work.students.length) {
        setStudents(work.students);
        setFileName(work.fileName);
        setExtraColumns(work.extraNumericColumns);
        setConfig({ ...defaultConfig(), ...work.config });
        setScenarios(work.scenarios);
        setWorking(work.working);
        setActive(Math.min(work.activeScenario, Math.max(0, work.working.length - 1)));
        setLocks(work.locks ?? {});
        setStep(work.working.length ? 'result' : 'setup');
        notifyToast({ type: 'info', title: '이전 반편성 작업을 불러왔습니다.', description: `${work.fileName} · ${new Date(work.savedAt).toLocaleString('ko-KR')}` });
      }
      setRestored(true);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!restored || students.length === 0) return;
    const t = setTimeout(() => {
      void saveWork({ fileName, students, extraNumericColumns: extraColumns, config, scenarios, activeScenario: active, working, locks })
        .catch(() => notifyToast({ type: 'error', title: '반편성 작업을 자동 저장하지 못했습니다.' }));
    }, 800);
    return () => clearTimeout(t);
  }, [restored, fileName, students, extraColumns, config, scenarios, active, working, locks]);

  // ---------- 파생 값 ----------
  const relations = useMemo(() => resolveRelations(students, config.twinsMode), [students, config.twinsMode]);
  const diagnostics = useMemo(() => {
    const out = [...parseDiagnostics, ...relations.diagnostics];
    const tooBig = students.filter(s => s.fixedClass && s.fixedClass > config.numClasses);
    if (tooBig.length) out.push({ level: 'warning', message: `고정반이 반 수(${config.numClasses})보다 큰 학생 ${tooBig.length}명: ${tooBig.map(s => s.name).join(', ')} — 고정을 무시합니다.` });
    return out;
  }, [parseDiagnostics, relations, students, config.numClasses]);
  const current = working[active];
  const stats = useMemo(() => (current ? computeClassStats(students, current, config) : []), [students, current, config]);
  const compliance = useMemo(() => (current ? evaluateCompliance(students, current, config, relations) : []), [students, current, config, relations]);
  const suggestions = useMemo(() => {
    if (!current || students.length > 800) return [];
    try { return suggestSwaps(students, config, relations, current, { locks }); } catch { return []; }
  }, [students, config, relations, current, locks]);
  const nameOf = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
  const conflictIds = useMemo(() => {
    const ids = new Set<string>();
    if (!current) return ids;
    for (const [a, b] of relations.separationPairs) if (current[a] === current[b]) { ids.add(a); ids.add(b); }
    for (const g of relations.togetherGroups) if (new Set(g.map(id => current[id])).size > 1) g.forEach(id => ids.add(id));
    for (const s of students) if (current[s.id] && s.excludedClasses.includes(current[s.id])) ids.add(s.id);
    return ids;
  }, [current, relations, students]);
  const highlightIds = useMemo(() => new Set(suggestions.flatMap(s => [s.studentA, s.studentB])), [suggestions]);
  const prevClasses = useMemo(() => [...new Set(students.map(s => s.prevClass))].sort((a, b) => a - b), [students]);
  const isoThr = useMemo(() => isolationThresholds(students, config.numClasses), [students, config.numClasses]);
  const maleCount = students.filter(s => s.gender === '남').length;
  const femaleCount = students.filter(s => s.gender === '여').length;
  const hasErrors = diagnostics.some(d => d.level === 'error');
  const importedCount = useMemo(() => students.reduce((m, s) => Math.max(m, s.importedClass ?? 0), 0), [students]);

  const academicText = (v: number | null) => (v === null ? '-' : config.academicBasis === 'rank' ? `상위 ${Math.round((1 - v) * 100)}%` : `${Math.round(v * 10) / 10}점`);

  // ---------- 동작 ----------
  const handleTemplate = async () => {
    try {
      const buf = await buildTemplateWorkbook();
      const saved = await window.electronAPI.saveBuffer(buf, '반편성_명단양식.xlsx');
      if (saved) notifyToast({ type: 'success', title: '양식을 저장했습니다.', description: saved });
    } catch {
      notifyToast({ type: 'error', title: '양식을 저장하지 못했습니다.' });
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (students.length && !window.confirm('새 명단을 올리면 지금 작업 중인 편성안이 사라집니다. 계속할까요?')) return;
    setBusy('명단을 읽는 중');
    try {
      const result = await parseRosterFile(file);
      if (result.students.length === 0) {
        setParseDiagnostics(result.diagnostics);
        notifyToast({ type: 'error', title: '학생을 찾지 못했습니다.', description: result.diagnostics[0]?.message });
        return;
      }
      setStudents(result.students);
      setFileName(file.name);
      setParseDiagnostics(result.diagnostics);
      setExtraColumns(result.extraNumericColumns);
      setScenarios([]);
      setWorking([]);
      setLocks({});
      setActive(0);
      const suggested = result.importedClassCount || Math.max(2, Math.round(result.students.length / 25));
      setConfig(prev => ({ ...prev, numClasses: Math.min(20, suggested), criteria: prev.criteria.filter(c => !c.id.startsWith('extra:')) }));
      setStep('setup');
    } catch (err) {
      notifyToast({ type: 'error', title: '파일을 읽지 못했습니다.', description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const runAll = async () => {
    if (students.length === 0) return;
    if (config.numClasses < 2 || config.numClasses > 20) { notifyToast({ type: 'warning', title: '반 수는 2~20 사이로 정해 주세요.' }); return; }
    setBusy('편성안 3개를 만드는 중');
    setProgress(0);
    try {
      const result = await runScenarios({ students, config, relations, locks }, setProgress);
      setScenarios(result);
      setWorking(result.map(s => ({ ...s.assignment })));
      setActive(0);
      setStep('result');
      const hard = result[0]?.report.hardViolations ?? 0;
      notifyToast(hard
        ? { type: 'warning', title: '편성안을 만들었지만 지키지 못한 필수 조건이 있습니다.', description: '「기준 충족 현황」에서 사유를 확인해 주세요.' }
        : { type: 'success', title: '편성안 3개를 만들었습니다.' });
    } catch (err) {
      notifyToast({ type: 'error', title: '편성 중 오류가 발생했습니다.', description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const loadImported = () => {
    const assignment: Assignment = {};
    for (const s of students) if (s.importedClass) assignment[s.id] = Math.min(config.numClasses, s.importedClass);
    const sc: Scenario = {
      id: 'imported', name: '불러온 배정안', tag: '파일', description: "업로드한 파일의 '배정반'을 그대로 불러왔습니다.",
      assignment, report: { iterations: 0, acceptedMoves: 0, elapsedMs: 0, seed: config.seed, initialCost: 0, finalCost: 0, hardViolations: 0 },
    };
    setScenarios([sc]);
    setWorking([{ ...assignment }]);
    setActive(0);
    setStep('result');
  };

  const updateCurrent = useCallback((fn: (a: Assignment) => Assignment) => {
    setWorking(prev => prev.map((a, i) => (i === active ? fn(a) : a)));
  }, [active]);

  const moveStudent = (id: string, classNo: number) => {
    if (!current || current[id] === classNo) return;
    updateCurrent(a => ({ ...a, [id]: classNo }));
    if (autoLock) setLocks(prev => ({ ...prev, [id]: classNo }));
  };

  const toggleLock = (id: string) => {
    setLocks(prev => {
      const next = { ...prev };
      if (next[id] !== undefined) delete next[id];
      else if (current?.[id]) next[id] = current[id];
      return next;
    });
  };

  const applySuggestion = (a: string, b: string) => {
    updateCurrent(cur => ({ ...cur, [a]: cur[b], [b]: cur[a] }));
  };

  const refine = async (boost?: string) => {
    if (!current) return;
    setBusy(boost ? `'${criterionLabel(boost)}' 기준을 다듬는 중` : '편성안을 다듬는 중');
    setProgress(0);
    try {
      const before = compliance;
      const result = await runRefine({ students, config, relations, locks, start: current, boost, seed: config.seed + 17 + active }, setProgress);
      updateCurrent(() => result.assignment);
      const after = evaluateCompliance(students, result.assignment, config, relations);
      const target = boost ? after.find(c => c.id === boost) : null;
      const prevTarget = boost ? before.find(c => c.id === boost) : null;
      notifyToast({
        type: 'success',
        title: target ? `${target.label}: ${prevTarget?.score ?? '-'}점 → ${target.score}점` : '편성안을 다듬었습니다.',
        description: '고정한 학생은 그대로 두었습니다.',
      });
    } catch (err) {
      notifyToast({ type: 'error', title: '다듬기 중 오류가 발생했습니다.', description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const exportResult = async () => {
    if (!current) return;
    try {
      const sc = scenarios[active] ?? null;
      const buf = await buildResultWorkbook(students, current, config, sc, compliance, extraColumns);
      const name = `반편성결과_${(sc?.name ?? '조정안').replace(/[\s·]+/g, '_')}.xlsx`;
      const saved = await window.electronAPI.saveBuffer(buf, name);
      if (saved) notifyToast({ type: 'success', title: '엑셀로 저장했습니다.', description: saved });
    } catch {
      notifyToast({ type: 'error', title: '엑셀 저장에 실패했습니다.' });
    }
  };

  const resetAll = async () => {
    if (!window.confirm('명단과 편성안을 모두 지울까요? 이 PC에 저장된 반편성 작업도 삭제됩니다.')) return;
    await clearWork().catch(() => undefined);
    setStudents([]); setFileName(''); setParseDiagnostics([]); setExtraColumns([]);
    setScenarios([]); setWorking([]); setLocks({}); setActive(0); setConfig(defaultConfig()); setStep('upload');
    notifyToast({ type: 'success', title: '반편성 작업을 모두 지웠습니다.' });
  };

  // ---------- 기준 순서 ----------
  const setCriteria = (fn: (c: CriterionSetting[]) => CriterionSetting[]) => setConfig(prev => ({ ...prev, criteria: fn(prev.criteria) }));
  const moveCriterion = (from: number, to: number) => setCriteria(list => {
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  });
  const addExtraCriterion = (col: string) => {
    const id = `extra:${col}` as SoftCriterionId;
    setCriteria(list => (list.some(c => c.id === id) ? list : [...list, { id, active: true }]));
  };

  // ---------- 화면 ----------
  const stepItems: Array<{ key: Step; label: string; enabled: boolean }> = [
    { key: 'upload', label: '1. 명단 올리기', enabled: true },
    { key: 'setup', label: '2. 기준 정하기', enabled: students.length > 0 },
    { key: 'result', label: '3. 결과 확인·조정', enabled: working.length > 0 },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#FAF9F7] dark:bg-[#171210] p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h2 className={`text-lg font-bold ${strong}`}>반편성</h2>
            <p className={`text-xs ${muted}`}>성비·생활지도·학업·전학년 반 분포를 고르게 맞추고, 분리요청·쌍생아·고정 배정을 지켜 다음 학년도 반을 편성합니다.</p>
          </div>
          {students.length > 0 && (
            <button type="button" onClick={() => void resetAll()} className={btnDanger}><Trash2 className="w-4 h-4" />모두 지우기</button>
          )}
        </div>

        <p className="flex gap-2 text-xs text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 leading-relaxed">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {isWeb
              ? '이 기능은 AI를 사용하지 않으며 학생 정보는 이 브라우저 밖으로 전송되지 않습니다. 작업 내용은 이 브라우저에 자동 저장되고 백업 파일에도 포함되니, 반편성이 끝나면 「모두 지우기」로 삭제해 주세요.'
              : '이 기능은 AI를 사용하지 않으며 학생 정보는 이 PC 밖으로 전송되지 않습니다. 작업 내용은 이 PC의 앱 데이터 폴더에 자동 저장되고 앱 백업 파일에도 포함되니, 반편성이 끝나면 「모두 지우기」로 삭제해 주세요.'}
          </span>
        </p>

        <nav className="flex flex-wrap gap-2" aria-label="반편성 단계">
          {stepItems.map(s => (
            <button
              key={s.key}
              type="button"
              disabled={!s.enabled}
              onClick={() => setStep(s.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors disabled:opacity-40 ${
                step === s.key ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-[#E7E5E4] dark:border-[#2E2822] text-[#57534E] dark:text-[#C4B8B0] bg-white dark:bg-[#221E1B]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {busy && (
          <div className={`${card} p-4 flex items-center gap-3`} role="status" aria-live="polite">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            <div className="flex-1">
              <div className={`text-sm font-bold ${strong}`}>{busy}…</div>
              <div className="mt-2 h-1.5 rounded-full bg-[#F0EBE6] dark:bg-[#2E2822] overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* ---------- 1. 명단 ---------- */}
        {step === 'upload' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className={`${card} p-5 space-y-3`}>
              <h3 className={`text-sm font-bold ${strong} flex items-center gap-2`}><FileSpreadsheet className="w-4 h-4 text-emerald-600" />양식 내려받기</h3>
              <p className={`text-xs leading-relaxed ${muted}`}>
                필수 열은 <b>전학년반·전학년번호·이름·성별</b>입니다. 석차(또는 평균성적), 생활지도(0~3), 기초학력, 특수교육, 분리요청, 같은반희망, 쌍생아, 고정반, 제외반은 있으면 반영합니다. 나이스에서 내려받은 명렬표의 열 이름을 양식에 맞게 바꿔도 됩니다.
              </p>
              <button type="button" onClick={() => void handleTemplate()} className={btnSecondary}><Download className="w-4 h-4" />명단 양식(.xlsx)</button>
            </div>
            <label
              className={`${card} p-5 flex flex-col items-center justify-center gap-2 text-center border-dashed cursor-pointer hover:border-emerald-400 transition-colors`}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); void handleFile(e.dataTransfer.files?.[0]); }}
            >
              <Upload className="w-8 h-8 text-emerald-500" />
              <span className={`text-sm font-bold ${strong}`}>명단 파일 올리기</span>
              <span className={`text-xs ${muted}`}>xlsx · csv (최대 5MB, 2,000명) — 클릭하거나 끌어다 놓으세요</span>
              <span className={`text-xs ${muted}`}>이전에 저장한 결과 파일을 올리면 배정반도 함께 불러옵니다.</span>
              <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={e => void handleFile(e.target.files?.[0])} />
            </label>
            {students.length > 0 && (
              <div className="md:col-span-2 text-xs text-right">
                <button type="button" className="font-bold text-emerald-700 dark:text-emerald-300" onClick={() => setStep('setup')}>지금 명단({students.length}명)으로 계속하기 →</button>
              </div>
            )}
            {parseDiagnostics.length > 0 && students.length === 0 && <div className="md:col-span-2"><DiagnosticList items={parseDiagnostics} /></div>}
          </div>
        )}

        {/* ---------- 2. 기준 ---------- */}
        {step === 'setup' && students.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div className="space-y-4">
              <div className={`${card} p-4`}>
                <div className={`text-xs ${muted}`}>{fileName}</div>
                <div className={`mt-1 text-sm ${strong}`}>
                  <b className="text-lg">{students.length}</b>명 · 전학년 {prevClasses.length}개 반 · 남 {maleCount} / 여 {femaleCount}
                </div>
                <div className={`mt-1 text-xs ${muted}`}>
                  분리요청 {relations.separationPairs.length}쌍 · 같은 반 묶음 {relations.togetherGroups.length}개 · 쌍생아 {relations.twinGroups.length}쌍 · 고정 {students.filter(s => s.fixedClass).length}명 · 특수교육 {students.filter(s => s.specialNeeds).length}명
                </div>
              </div>
              <DiagnosticList items={diagnostics} />
              <div className={`${card} p-4 space-y-3`}>
                <h3 className={`text-sm font-bold ${strong} flex items-center gap-2`}><Settings2 className="w-4 h-4 text-emerald-600" />기본 설정</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <label className="space-y-1">
                    <span className={`text-xs font-medium ${muted}`}>새 학년 반 수</span>
                    <input type="number" min={2} max={20} value={config.numClasses} className={`${input} w-full`}
                      onChange={e => setConfig(p => ({ ...p, numClasses: Math.max(2, Math.min(20, Number(e.target.value) || 2)) }))} />
                    <span className={`block text-[11px] ${muted}`}>반당 약 {Math.round((students.length / Math.max(config.numClasses, 1)) * 10) / 10}명</span>
                  </label>
                  <label className="space-y-1">
                    <span className={`text-xs font-medium ${muted}`}>반 이름</span>
                    <select value={config.labelStyle} className={`${input} w-full`} onChange={e => setConfig(p => ({ ...p, labelStyle: e.target.value as AssignmentConfig['labelStyle'] }))}>
                      <option value="korean">가반, 나반, 다반…</option>
                      <option value="number">1반, 2반, 3반…</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className={`text-xs font-medium ${muted}`}>학업 수준 기준</span>
                    <select value={config.academicBasis} className={`${input} w-full`} onChange={e => setConfig(p => ({ ...p, academicBasis: e.target.value as AssignmentConfig['academicBasis'] }))}>
                      <option value="rank">반 내 석차(반 규모 보정)</option>
                      <option value="score">평균성적(점수)</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className={`text-xs font-medium ${muted}`}>쌍생아</span>
                    <select value={config.twinsMode} className={`${input} w-full`} onChange={e => setConfig(p => ({ ...p, twinsMode: e.target.value as AssignmentConfig['twinsMode'] }))}>
                      <option value="together">같은 반에 배정</option>
                      <option value="separate">다른 반에 배정</option>
                      <option value="ignore">고려하지 않음</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className={`text-xs font-medium ${muted}`}>특수교육대상 1명을</span>
                    <select value={config.specialNeedsWeight} className={`${input} w-full`} onChange={e => setConfig(p => ({ ...p, specialNeedsWeight: Number(e.target.value) }))}>
                      <option value={1}>1명으로 계산</option>
                      <option value={2}>2명으로 계산(학급 인원 감축)</option>
                      <option value={3}>3명으로 계산</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className={`text-xs font-medium ${muted}`}>재현 번호(시드)</span>
                    <input type="number" value={config.seed} className={`${input} w-full`} onChange={e => setConfig(p => ({ ...p, seed: Math.floor(Number(e.target.value) || 0) }))} />
                    <span className={`block text-[11px] ${muted}`}>같은 명단·설정·번호면 항상 같은 결과</span>
                  </label>
                </div>
              </div>
            </div>

            <div className={`${card} p-4 space-y-3`}>
              <div>
                <h3 className={`text-sm font-bold ${strong}`}>균형 기준과 우선순위</h3>
                <p className={`text-xs mt-1 ${muted}`}>위에 있을수록 더 중요하게 맞춥니다. 끌어서 옮기거나 ▲▼로 순서를 바꾸세요. 인원 균형·분리요청·같은 반·고정·제외 반은 <b>필수 조건</b>으로 항상 지킵니다.</p>
              </div>
              <ol className="space-y-1.5">
                {config.criteria.map((c, i) => {
                  const meta = CRITERION_META[c.id];
                  return (
                    <li
                      key={c.id}
                      draggable
                      onDragStart={() => setDragIdx(i)}
                      onDragOver={e => { e.preventDefault(); if (dragIdx !== null && dragIdx !== i) { moveCriterion(dragIdx, i); setDragIdx(i); } }}
                      onDragEnd={() => setDragIdx(null)}
                      className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                        c.active ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-900/10' : 'border-[#EDE8E1] dark:border-[#2E2822] opacity-60'
                      } ${dragIdx === i ? 'opacity-40' : ''}`}
                    >
                      <GripVertical className="w-4 h-4 text-[#C4B8B0] cursor-move shrink-0 hidden sm:block" />
                      <input type="checkbox" checked={c.active} className="w-4 h-4 accent-emerald-600" aria-label={`${criterionLabel(c.id)} 사용`}
                        onChange={() => setCriteria(list => list.map(x => (x.id === c.id ? { ...x, active: !x.active } : x)))} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${strong}`}>
                          {c.active && <span className="mr-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">{config.criteria.slice(0, i + 1).filter(x => x.active).length}순위</span>}
                          {criterionLabel(c.id)}
                        </div>
                        <div className={`text-[11px] ${muted} truncate`}>{meta?.help ?? '추가 열의 반 평균이 고르게'}</div>
                      </div>
                      <button type="button" onClick={() => moveCriterion(i, i - 1)} disabled={i === 0} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30" aria-label="위로"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => moveCriterion(i, i + 1)} disabled={i === config.criteria.length - 1} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30" aria-label="아래로"><ArrowDown className="w-3.5 h-3.5" /></button>
                      {c.id.startsWith('extra:') && (
                        <button type="button" onClick={() => setCriteria(list => list.filter(x => x.id !== c.id))} className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label="기준 삭제"><XCircle className="w-3.5 h-3.5" /></button>
                      )}
                    </li>
                  );
                })}
              </ol>
              {extraColumns.filter(col => !config.criteria.some(c => c.id === `extra:${col}`)).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={muted}>추가 열을 기준으로:</span>
                  {extraColumns.filter(col => !config.criteria.some(c => c.id === `extra:${col}`)).map(col => (
                    <button key={col} type="button" onClick={() => addExtraCriterion(col)} className="px-2 py-1 rounded-full border border-emerald-300 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">+ {col}</button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" onClick={() => void runAll()} disabled={!!busy} className={btnPrimary}><Wand2 className="w-4 h-4" />편성안 3개 만들기</button>
                {importedCount > 0 && (
                  <button type="button" onClick={loadImported} className={btnSecondary}><FileSpreadsheet className="w-4 h-4" />파일의 배정반 불러오기</button>
                )}
              </div>
              {hasErrors && <p className="text-xs text-red-600 dark:text-red-300">명단에 오류가 있습니다. 성별을 알 수 없는 학생은 성비 계산에서 빠집니다. 고친 파일을 다시 올리는 것을 권장합니다.</p>}
            </div>
          </div>
        )}

        {/* ---------- 3. 결과 ---------- */}
        {step === 'result' && current && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {scenarios.map((sc, i) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`text-left px-4 py-2.5 rounded-xl border transition-all ${
                    i === active ? 'border-emerald-500 bg-emerald-600 text-white shadow' : `${card} hover:border-emerald-300`
                  }`}
                >
                  <div className="text-sm font-bold">{sc.name} <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${i === active ? 'bg-white/20' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>{sc.tag}</span></div>
                  <div className={`text-[11px] ${i === active ? 'text-white/80' : muted}`}>{sc.description}</div>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void exportResult()} className={btnPrimary}><Download className="w-4 h-4" />엑셀로 저장</button>
              <button type="button" onClick={() => void refine()} disabled={!!busy} className={btnSecondary}><RefreshCw className="w-4 h-4" />전체 다시 다듬기</button>
              <button type="button" onClick={() => setStep('setup')} className={btnSecondary}><Settings2 className="w-4 h-4" />기준 바꿔 새로 편성</button>
              <label className={`ml-auto flex items-center gap-1.5 text-xs ${muted}`}>
                <input type="checkbox" checked={autoLock} onChange={e => setAutoLock(e.target.checked)} className="accent-emerald-600" />
                직접 옮긴 학생 자동 고정
              </label>
              {Object.keys(locks).length > 0 && (
                <button type="button" onClick={() => setLocks({})} className="text-xs font-medium text-emerald-700 dark:text-emerald-300">고정 {Object.keys(locks).length}명 모두 해제</button>
              )}
            </div>
            {scenarios[active]?.report.iterations ? (
              <p className={`text-[11px] ${muted}`}>
                탐색 {scenarios[active].report.iterations.toLocaleString()}회 · 개선 이동 {scenarios[active].report.acceptedMoves.toLocaleString()}회 · {scenarios[active].report.elapsedMs}ms · 재현 번호 {scenarios[active].report.seed}
              </p>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className={`${card} p-4`}>
                <h3 className={`text-sm font-bold ${strong} mb-3 flex items-center gap-2`}><CheckCircle2 className="w-4 h-4 text-emerald-600" />기준 충족 현황</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {compliance.map(c => {
                    const st = statusStyle[c.status];
                    const open = expanded.has(c.id);
                    return (
                      <li key={c.id} className={`rounded-lg border p-2.5 ${st.cls}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold flex-1 truncate">{c.hard && <span className="mr-1 text-[9px] px-1 rounded bg-black/10 dark:bg-white/10">필수</span>}{c.label}</span>
                          <span className="text-[10px] font-bold">{st.text}</span>
                          <span className="text-xs font-bold tabular-nums">{c.score}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] opacity-90">{c.summary}</div>
                        <div className="mt-1 flex items-center gap-2">
                          {c.issues.length > 0 && (
                            <button type="button" onClick={() => setExpanded(prev => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} className="text-[10px] font-bold underline inline-flex items-center">
                              자세히 {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                          {c.status !== 'pass' && !c.hard && (
                            <button type="button" disabled={!!busy} onClick={() => void refine(c.id)} className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded bg-white/70 dark:bg-black/20 hover:bg-white">이 기준 다시 다듬기</button>
                          )}
                          {c.status !== 'pass' && c.hard && (
                            <button type="button" disabled={!!busy} onClick={() => void refine()} className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded bg-white/70 dark:bg-black/20 hover:bg-white">자동 해결 시도</button>
                          )}
                        </div>
                        {open && <ul className="mt-1.5 space-y-0.5 text-[11px] max-h-32 overflow-y-auto">{c.issues.map((t, k) => <li key={k}>· {t}</li>)}</ul>}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className={`${card} p-4`}>
                <h3 className={`text-sm font-bold ${strong} mb-1 flex items-center gap-2`}><Lightbulb className="w-4 h-4 text-amber-500" />개선 제안</h3>
                <p className={`text-[11px] mb-3 ${muted}`}>두 학생을 맞바꾸면 균형이 더 좋아지는 경우를 보여 줍니다(노란색 표시). 고정한 학생은 제외합니다.</p>
                {suggestions.length === 0 ? (
                  <p className={`text-xs ${muted}`}>지금 배정에서 1:1 교환으로 더 나아지는 곳이 없습니다.</p>
                ) : (
                  <ul className="space-y-2">
                    {suggestions.map(sg => {
                      const a = nameOf.get(sg.studentA)!;
                      const b = nameOf.get(sg.studentB)!;
                      return (
                        <li key={`${sg.studentA}-${sg.studentB}`} className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/10 p-2.5">
                          <div className={`text-xs ${strong}`}>
                            <b>{a.name}</b>({classLabel(current[a.id], config.labelStyle)}) ⇄ <b>{b.name}</b>({classLabel(current[b.id], config.labelStyle)})
                          </div>
                          <div className={`text-[11px] ${muted}`}>{sg.effects.join(' · ') || '전체 균형 개선'}</div>
                          <button type="button" onClick={() => applySuggestion(a.id, b.id)} className="mt-1.5 text-[11px] font-bold px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600">맞바꾸기</button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className={`${card} p-4`}>
              <button type="button" onClick={() => setShowMatrix(!showMatrix)} className={`w-full flex items-center justify-between text-sm font-bold ${strong}`}>
                전학년 반 → 배정반 이동표 {showMatrix ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showMatrix && <div className="mt-3"><TransitionMatrix stats={stats} prevClasses={prevClasses} labelStyle={config.labelStyle} isoThr={isoThr} /></div>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {stats.map(st => (
                <ClassCard
                  key={st.classNo}
                  stat={st}
                  students={students.filter(s => current[s.id] === st.classNo).sort((x, y) => (x.gender === y.gender ? x.name.localeCompare(y.name, 'ko') : x.gender === '남' ? -1 : 1))}
                  numClasses={config.numClasses}
                  labelStyle={config.labelStyle}
                  academicText={academicText(st.academic)}
                  locks={locks}
                  conflictIds={conflictIds}
                  highlightIds={highlightIds}
                  onMove={moveStudent}
                  onToggleLock={toggleLock}
                />
              ))}
            </div>
            <p className={`text-[11px] ${muted}`}>
              ● 파랑 = 남, 빨강 = 여 · 작은 주황/빨강 점 = 생활지도 1~3 · 기 = 기초학력 · 특 = 특수교육 · 빨간 테두리 = 필수 조건 위반 · 노란 테두리 = 개선 제안 대상 · 자물쇠 = 고정. 학생을 끌어다 다른 반에 놓거나 「이동」을 눌러 옮길 수 있습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassAssignmentScreen;
