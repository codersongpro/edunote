import { beforeEach, describe, expect, it, vi } from 'vitest';

// IndexedDB 대신 메모리 저장소로 바꿔 웹 어댑터의 규칙만 검사한다.
const memory = new Map<string, unknown>();
vi.mock('../storage', () => ({
  kvGet: async (ns: string, key: string) => memory.get(`${ns}:${key}`),
  kvSet: async (ns: string, key: string, value: unknown) => { memory.set(`${ns}:${key}`, value); },
  kvDelete: async (ns: string, key: string) => { memory.delete(`${ns}:${key}`); },
  kvEntries: async (ns: string) => Object.fromEntries(
    [...memory.entries()].filter(([k]) => k.startsWith(`${ns}:`)).map(([k, v]) => [k.slice(ns.length + 1), v]),
  ),
  kvClearAll: async () => { memory.clear(); },
  requestPersistentStorage: () => {},
}));

const savedBlobs: Array<{ blob: Blob; name: string }> = [];
let nextPickedFile: File | null = null;
vi.mock('../files', () => ({
  saveBlob: async (blob: Blob, name: string) => { savedBlobs.push({ blob, name }); return `다운로드 폴더/${name}`; },
  pickFile: async () => nextPickedFile,
  dataUrlToBlob: () => null,
}));

(globalThis as any).__APP_VERSION__ = '9.9.9';
const { webApi, webExtras } = await import('../webApi');

beforeEach(() => {
  memory.clear();
  savedBlobs.length = 0;
  sessionStorage.clear();
  localStorage.clear();
  nextPickedFile = null;
});

describe('웹판 설정', () => {
  it('저장 전에는 데스크톱과 같은 기본값을 돌려준다', async () => {
    expect(await webApi.getConfig('schoolLevel')).toBe('고등학교');
    expect(await webApi.getConfig('privacyModeEnabled')).toBe(true);
  });

  it('허용되지 않은 키·잘못된 타입·저장 경로 키는 저장하지 않는다', async () => {
    await webApi.setConfig({ teacherName: '김교사', darkMode: 'yes', saveDir: '/tmp', unknownKey: 1 });
    expect(await webApi.getConfig('teacherName')).toBe('김교사');
    expect(await webApi.getConfig('darkMode')).toBe(false);
    expect(memory.has('config:saveDir')).toBe(false);
    expect(await webApi.getConfig('unknownKey')).toBeUndefined();
  });

  it('API 키는 설정 조회·백업에 섞이지 않고 localStorage에도 남지 않는다', async () => {
    await webApi.setApiKey('AIza-test-key', 'free');
    await webApi.setConfig({ naramarketApiKey: 'nara-key' });
    expect(await webApi.hasApiKey()).toBe(true);
    expect(await webApi.hasNaramarketKey()).toBe(true);
    const all = await webApi.getAllConfig();
    expect(JSON.stringify(all)).not.toContain('AIza-test-key');
    expect(JSON.stringify(all)).not.toContain('nara-key');
    expect(JSON.stringify({ ...localStorage })).not.toContain('AIza-test-key');

    await webApi.exportBackup({});
    const raw = await savedBlobs[0].blob.text();
    expect(raw).not.toContain('AIza-test-key');
    expect(raw).not.toContain('nara-key');
  });

  it('기억하기를 끄면 키를 탭 세션에만 두고, 다시 켜면 브라우저 저장소로 옮긴다', async () => {
    await webExtras.setRememberSecrets(false);
    await webApi.setApiKey('AIza-session', 'free');
    expect(memory.has('secret:geminiApiKey')).toBe(false);
    expect(sessionStorage.length).toBe(1);
    await webExtras.setRememberSecrets(true);
    expect(memory.get('secret:geminiApiKey')).toBe('AIza-session');
    expect(sessionStorage.length).toBe(0);
  });

  it('API 키가 없으면 AI 요청을 보내지 않고 안내한다', async () => {
    await expect(webApi.aiGenerate('안녕')).rejects.toThrow('API 키가 설정되지 않았습니다');
  });
});

describe('웹판 데이터·백업', () => {
  it('데이터 파일 이름에서 경로 문자를 제거한다', async () => {
    const where = await webApi.writeJsonData('../student-memos', [{ id: 1 }]);
    expect(where).toBe('브라우저 저장소/student-memos.json');
    expect(await webApi.readJsonData('student-memos')).toEqual([{ id: 1 }]);
    expect(await webApi.readJsonData('none')).toBeNull();
  });

  it('내보낸 백업을 다시 불러오고, 되돌리기로 원래 상태를 복구한다', async () => {
    await webApi.setConfig({ teacherName: '백업 전' });
    await webApi.writeJsonData('resource-library', ['원본']);
    await webApi.exportBackup({ menuOrder: '[1,2]' });
    const backupText = await savedBlobs[0].blob.text();
    expect(JSON.parse(backupText).app).toBe('EduNote');

    await webApi.setConfig({ teacherName: '바뀐 이름' });
    await webApi.writeJsonData('resource-library', ['바뀐 자료']);

    nextPickedFile = new File([backupText], 'edunote_backup.json', { type: 'application/json' });
    const inspection = await webApi.inspectBackup();
    expect(inspection?.dataFileCount).toBe(1);
    const restored = await webApi.restoreBackup(inspection!.inspectionId);
    expect(restored.localStorage).toEqual({ menuOrder: '[1,2]' });
    expect(await webApi.getConfig('teacherName')).toBe('백업 전');
    expect(await webApi.readJsonData('resource-library')).toEqual(['원본']);

    await webApi.rollbackBackupRestore(restored.restoreId);
    expect(await webApi.getConfig('teacherName')).toBe('바뀐 이름');
    expect(await webApi.readJsonData('resource-library')).toEqual(['바뀐 자료']);
  });

  it('EduNote 백업이 아닌 파일은 거부한다', async () => {
    nextPickedFile = new File(['{"hello":1}'], 'x.json');
    await expect(webApi.inspectBackup()).rejects.toThrow('EduNote 백업 파일 형식이 아닙니다.');
  });

  it('CSV는 엑셀 호환을 위해 BOM을 붙여 저장한다', async () => {
    await webApi.saveCsv('이름,점수', '명단.csv');
    const bytes = new Uint8Array(await savedBlobs[0].blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('HWPX는 날짜를 붙인 이름의 zip 파일로 저장한다', async () => {
    await webApi.saveHwpx('계획서', '<p>본문</p>', { title: '독서 계획' });
    const { name, blob } = savedBlobs[0];
    expect(name).toMatch(/^\(\d{6}\)_독서 계획\.hwpx$/);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b]); // "PK" zip 시그니처
  });

  it('웹에서 지원하지 않는 기능은 조용히 비활성 값을 돌려준다', async () => {
    expect(await webApi.selectFolder()).toBeNull();
    expect(await webApi.autoBackup({})).toBeNull();
    expect(await webApi.screenshotUrl('https://example.com')).toBeNull();
    expect(await webApi.checkUpdate()).toMatchObject({ currentVersion: '9.9.9', hasUpdate: false });
  });

  it('외부 링크는 https만 연다', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(await webApi.openExternal('javascript:alert(1)')).toBe(false);
    expect(await webApi.openExternal('http://example.com')).toBe(false);
    expect(await webApi.openExternal('https://example.com')).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    open.mockRestore();
  });

  it('데이터 지우기는 키·설정·자료를 모두 지운다', async () => {
    await webApi.setApiKey('AIza-x', 'free');
    await webApi.writeJsonData('student-memos', [1]);
    localStorage.setItem('menuOrder', '1');
    await webExtras.clearAllData();
    expect(await webApi.hasApiKey()).toBe(false);
    expect(await webApi.readJsonData('student-memos')).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});
