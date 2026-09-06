import { describe, it, expect, vi } from 'vitest';
import {
  clearWorkDraft,
  hasMeaningfulWork,
  parseWorkDraft,
  WorkDraftSaveQueue,
  WORK_DRAFT_VERSION,
} from '../workDraft';
import { createInitialGlobalState, initialGlobalState } from '../../GlobalStateContext';
import { GlobalState } from '../../types';

function withOpinionStudent(overrides: Record<string, unknown>): GlobalState {
  return {
    ...initialGlobalState,
    opinion: {
      ...initialGlobalState.opinion,
      students: [{ ...initialGlobalState.opinion.students[0], ...overrides }],
    },
  };
}

describe('hasMeaningfulWork', () => {
  it('초기 상태는 복원할 가치가 없다고 판단한다', () => {
    expect(hasMeaningfulWork(initialGlobalState)).toBe(false);
  });

  it('관찰 내용을 입력했으면 복원 대상이다', () => {
    expect(hasMeaningfulWork(withOpinionStudent({ additionalContext: '발표를 잘함' }))).toBe(true);
  });

  it('태그를 선택했으면 복원 대상이다', () => {
    expect(hasMeaningfulWork(withOpinionStudent({ positiveTags: ['성실'] }))).toBe(true);
  });

  it('생성 결과가 있으면 복원 대상이다', () => {
    expect(hasMeaningfulWork(withOpinionStudent({ generatedContent: '성실하게 참여함.' }))).toBe(true);
  });

  it('공백만 있는 입력은 복원 대상이 아니다', () => {
    expect(hasMeaningfulWork(withOpinionStudent({ additionalContext: '   ' }))).toBe(false);
  });

  it('학생을 여러 명 만들었으면 복원 대상이다', () => {
    const state: GlobalState = {
      ...initialGlobalState,
      sports: {
        ...initialGlobalState.sports,
        students: [
          { id: '1', name: '김민수', additionalContext: '', selected: false },
          { id: '2', name: '이지은', additionalContext: '', selected: false },
        ],
      },
    };
    expect(hasMeaningfulWork(state)).toBe(true);
  });

  it('과목·활동 데이터가 쌓였으면 복원 대상이다', () => {
    const state: GlobalState = {
      ...initialGlobalState,
      subject: {
        ...initialGlobalState.subject,
        dataStore: { 수학: { tasks: [], students: [] } },
      },
    };
    expect(hasMeaningfulWork(state)).toBe(true);
  });

  it('챗봇 대화가 있으면 복원 대상이다', () => {
    const state: GlobalState = {
      ...initialGlobalState,
      recordChatbot: { messages: [{ role: 'user', text: '안녕', timestamp: 1 }] },
    };
    expect(hasMeaningfulWork(state)).toBe(true);
  });
});

describe('parseWorkDraft', () => {
  it('저장한 초안을 그대로 복원한다', () => {
    const state = withOpinionStudent({ additionalContext: '발표를 잘함' });
    const raw = { version: WORK_DRAFT_VERSION, savedAt: '2026-08-19T00:00:00.000Z', state };
    const parsed = parseWorkDraft(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.state.opinion.students[0].additionalContext).toBe('발표를 잘함');
    expect(parsed!.savedAt).toBe('2026-08-19T00:00:00.000Z');
  });

  it('형식이 아니거나 비어 있으면 null을 돌려준다', () => {
    expect(parseWorkDraft(null)).toBeNull();
    expect(parseWorkDraft('문자열')).toBeNull();
    expect(parseWorkDraft({})).toBeNull();
    expect(parseWorkDraft({ version: WORK_DRAFT_VERSION })).toBeNull();
  });

  it('버전이 다르면 복원하지 않는다', () => {
    const raw = { version: 999, savedAt: '2026-08-19T00:00:00.000Z', state: initialGlobalState };
    expect(parseWorkDraft(raw)).toBeNull();
  });

  it('복원할 내용이 없으면(초기 상태) null을 돌려준다', () => {
    const raw = { version: WORK_DRAFT_VERSION, savedAt: '2026-08-19T00:00:00.000Z', state: initialGlobalState };
    expect(parseWorkDraft(raw)).toBeNull();
  });

  it('일부 구역이 빠진 초안도 기본값으로 메워 복원한다', () => {
    // 구버전 초안이나 손상된 파일이 들어와도 앱이 깨지지 않아야 한다.
    const partial = {
      version: WORK_DRAFT_VERSION,
      savedAt: '2026-08-19T00:00:00.000Z',
      state: { opinion: withOpinionStudent({ additionalContext: '내용' }).opinion },
    };
    const parsed = parseWorkDraft(partial);
    expect(parsed).not.toBeNull();
    expect(parsed!.state.opinion.students[0].additionalContext).toBe('내용');
    // 빠진 구역은 초기값으로 채워진다
    expect(parsed!.state.sports).toEqual(initialGlobalState.sports);
    expect(parsed!.state.recordChatbot).toEqual(initialGlobalState.recordChatbot);
  });
});

describe('학생 데이터 삭제 경계', () => {
  it('삭제용 초안 비우기가 실패하면 호출자에게 오류를 전달한다', async () => {
    const error = new Error('초안 파일을 쓸 수 없음');
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      writeJsonData: vi.fn().mockRejectedValue(error),
    };

    await expect(clearWorkDraft()).rejects.toBe(error);
  });

  it('삭제 시작 전에 실행 중인 저장을 기다리고 예약된 옛 저장은 실행하지 않는다', async () => {
    const queue = new WorkDraftSaveQueue();
    let finishActiveSave: (() => void) | undefined;
    const activeSave = vi.fn(() => new Promise<void>(resolve => { finishActiveSave = resolve; }));
    const scheduledSave = vi.fn().mockResolvedValue(undefined);

    void queue.enqueue(activeSave);
    void queue.enqueue(scheduledSave);
    await vi.waitFor(() => expect(activeSave).toHaveBeenCalledTimes(1));

    let drained = false;
    const drainPromise = queue.invalidateAndWait().then(() => { drained = true; });
    await Promise.resolve();
    expect(drained).toBe(false);

    finishActiveSave?.();
    await drainPromise;

    expect(scheduledSave).not.toHaveBeenCalled();
  });

  it('삭제 후 초기 상태는 기존 초기 상태와 내부 객체를 공유하지 않는다', () => {
    const first = createInitialGlobalState();
    const second = createInitialGlobalState();

    first.opinion.students[0].name = '변경된 이름';

    expect(second.opinion.students[0].name).toBe('학생 1');
    expect(initialGlobalState.opinion.students[0].name).toBe('학생 1');
  });
});
