import { generateScenarios, optimize, REFINE_BOOST, refineIterations, type OptimizeResult } from './engine';
import type { WorkerRequest } from './engine.worker';
import type { Scenario } from './types';

// 계산 실행기 — Web Worker로 돌리고, 워커를 만들 수 없는 환경이면 같은 스레드에서 실행한다.

type ScenarioReq = Extract<WorkerRequest, { type: 'scenarios' }>;
type RefineReq = Extract<WorkerRequest, { type: 'refine' }>;

function run<R>(req: WorkerRequest, pick: (msg: { scenarios?: Scenario[]; result?: OptimizeResult }) => R, inline: () => R, onProgress: (f: number) => void): Promise<R> {
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    worker = null;
  }
  if (!worker) {
    return new Promise((resolve, reject) => setTimeout(() => {
      try { resolve(inline()); } catch (e) { reject(e); }
    }, 30));
  }
  const w = worker;
  return new Promise((resolve, reject) => {
    let settled = false;
    w.onmessage = (e: MessageEvent) => {
      const msg = e.data as { type: string; value?: number; scenarios?: Scenario[]; result?: OptimizeResult; message?: string };
      if (msg.type === 'progress') { onProgress(msg.value ?? 0); return; }
      settled = true;
      w.terminate();
      if (msg.type === 'error') reject(new Error(msg.message));
      else resolve(pick(msg));
    };
    w.onerror = ev => {
      ev.preventDefault();
      if (settled) return;
      settled = true;
      w.terminate();
      try { resolve(inline()); } catch (err) { reject(err); }
    };
    w.postMessage(req);
  });
}

export function runScenarios(req: Omit<ScenarioReq, 'type'>, onProgress: (f: number) => void): Promise<Scenario[]> {
  const full: ScenarioReq = { ...req, type: 'scenarios' };
  return run(full, m => m.scenarios ?? [],
    () => generateScenarios(req.students, req.config, req.relations, { locks: req.locks, onProgress }), onProgress);
}

export function runRefine(req: Omit<RefineReq, 'type'>, onProgress: (f: number) => void): Promise<OptimizeResult> {
  const full: RefineReq = { ...req, type: 'refine' };
  return run(full, m => m.result!, () => optimize(req.students, req.config, req.relations, {
    seed: req.seed, start: req.start, locks: req.locks, weightMultipliers: req.boost ? { [req.boost]: REFINE_BOOST } : undefined,
    iterations: refineIterations(req.students.length), temperatureScale: 0.03, onProgress,
  }), onProgress);
}
