import { generateScenarios, optimize, REFINE_BOOST, refineIterations } from './engine';
import type { Assignment, AssignmentConfig, ClassStudent, ResolvedRelations } from './types';

// 반편성 계산을 화면과 분리된 스레드에서 실행한다(대규모 학년에서도 화면이 멈추지 않게).

export type WorkerRequest =
  | { type: 'scenarios'; students: ClassStudent[]; config: AssignmentConfig; relations: ResolvedRelations; locks: Assignment }
  | {
    type: 'refine'; students: ClassStudent[]; config: AssignmentConfig; relations: ResolvedRelations; locks: Assignment;
    start: Assignment; boost?: string; seed: number;
  };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  const progress = (f: number) => self.postMessage({ type: 'progress', value: f });
  try {
    if (req.type === 'scenarios') {
      const scenarios = generateScenarios(req.students, req.config, req.relations, { locks: req.locks, onProgress: progress });
      self.postMessage({ type: 'scenarios', scenarios });
    } else {
      const result = optimize(req.students, req.config, req.relations, {
        seed: req.seed, start: req.start, locks: req.locks,
        weightMultipliers: req.boost ? { [req.boost]: REFINE_BOOST } : undefined,
        iterations: refineIterations(req.students.length),
        temperatureScale: 0.03,
        onProgress: progress,
      });
      self.postMessage({ type: 'refine', result });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
