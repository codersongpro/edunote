interface RegenerationTarget {
  scope?: string;
  studentId: string;
  expectedContent?: string;
}

export interface RegenerationRequest extends RegenerationTarget {
  version: number;
}

interface GeneratedResult {
  generatedContent: string;
  generatedModel: string;
  privacyApplied: boolean;
}

interface StudentResultFields {
  id: string;
  generatedContent?: string;
  generatedModel?: string;
  privacyApplied?: boolean;
}

const targetKey = ({ scope = '', studentId }: Pick<RegenerationTarget, 'scope' | 'studentId'>) => `${scope}\0${studentId}`;

export class RegenerationRequestRegistry {
  private versions = new Map<string, number>();

  begin(target: RegenerationTarget): RegenerationRequest {
    const key = targetKey(target);
    const version = (this.versions.get(key) ?? 0) + 1;
    this.versions.set(key, version);
    return { ...target, version };
  }

  invalidate(target: Pick<RegenerationTarget, 'scope' | 'studentId'>): void {
    const key = targetKey(target);
    this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
  }

  invalidateScope(scope: string): void {
    const prefix = `${scope}\0`;
    for (const [key, version] of this.versions) {
      if (key.startsWith(prefix)) this.versions.set(key, version + 1);
    }
  }

  invalidateAll(): void {
    for (const [key, version] of this.versions) {
      this.versions.set(key, version + 1);
    }
  }

  isCurrent(request: RegenerationRequest): boolean {
    return this.versions.get(targetKey(request)) === request.version;
  }
}

export function applyRegenerationResult<T extends StudentResultFields>(
  registry: RegenerationRequestRegistry,
  students: T[],
  request: RegenerationRequest,
  result: GeneratedResult,
): { students: T[]; applied: boolean } {
  if (!registry.isCurrent(request)) return { students, applied: false };

  const index = students.findIndex(student => student.id === request.studentId);
  if (index === -1 || students[index].generatedContent !== request.expectedContent) {
    return { students, applied: false };
  }

  const updated = [...students];
  updated[index] = { ...updated[index], ...result };
  return { students: updated, applied: true };
}

export function applyScopedRegenerationResult<
  TStudent extends StudentResultFields,
  TScopeData extends { students: TStudent[] },
>(
  registry: RegenerationRequestRegistry,
  state: {
    currentScope: string;
    activeStudents: TStudent[];
    dataStore: Record<string, TScopeData>;
  },
  request: RegenerationRequest,
  result: GeneratedResult,
): { activeStudents: TStudent[]; dataStore: Record<string, TScopeData>; applied: boolean } {
  if (!request.scope) return { ...state, applied: false };

  const isActiveScope = request.scope === state.currentScope;
  const scopeData = state.dataStore[request.scope];
  const sourceStudents = isActiveScope ? state.activeStudents : scopeData?.students;
  if (!sourceStudents) return { ...state, applied: false };

  const applied = applyRegenerationResult(registry, sourceStudents, request, result);
  if (!applied.applied) return { ...state, applied: false };

  const dataStore = scopeData
    ? { ...state.dataStore, [request.scope]: { ...scopeData, students: applied.students } }
    : state.dataStore;
  return {
    activeStudents: isActiveScope ? applied.students : state.activeStudents,
    dataStore,
    applied: true,
  };
}
