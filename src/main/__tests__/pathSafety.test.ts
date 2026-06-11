import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { isPathInside, resolveOpenableDir, resolveDialogPath } from '../pathSafety';

const ROOT = path.resolve('/home/user/edunote-data');

const dirStat = () => ({ isDirectory: () => true });
const fileStat = () => ({ isDirectory: () => false });
const missingStat = () => null;

describe('isPathInside', () => {
  it('루트 자신과 하위 경로는 통과한다', () => {
    expect(isPathInside(ROOT, ROOT)).toBe(true);
    expect(isPathInside(path.join(ROOT, 'docs'), ROOT)).toBe(true);
    expect(isPathInside(path.join(ROOT, 'a', 'b'), ROOT)).toBe(true);
  });

  it('루트 밖 경로는 거부한다', () => {
    expect(isPathInside(path.resolve('/etc'), ROOT)).toBe(false);
    expect(isPathInside(path.resolve('/home/user'), ROOT)).toBe(false);
  });

  it('루트와 접두사만 같은 형제 경로는 거부한다', () => {
    expect(isPathInside(path.resolve('/home/user/edunote-data-evil'), ROOT)).toBe(false);
  });
});

describe('resolveOpenableDir', () => {
  it('허용 루트 하위의 실제 디렉터리는 정규화된 경로를 반환한다', () => {
    const target = path.join(ROOT, 'docs');
    expect(resolveOpenableDir(target, [ROOT], dirStat)).toBe(target);
  });

  it('상위 탈출(..)을 정규화한 뒤 검사한다', () => {
    const sneaky = path.join(ROOT, 'docs', '..', '..', '..', 'etc');
    expect(resolveOpenableDir(sneaky, [ROOT], dirStat)).toBeNull();
  });

  it('허용 루트 밖 경로는 거부한다', () => {
    expect(resolveOpenableDir('/etc', [ROOT], dirStat)).toBeNull();
  });

  it('디렉터리가 아닌 파일은 거부한다 (openPath 실행 방지)', () => {
    expect(resolveOpenableDir(path.join(ROOT, 'run.exe'), [ROOT], fileStat)).toBeNull();
  });

  it('존재하지 않는 경로는 거부한다', () => {
    expect(resolveOpenableDir(path.join(ROOT, 'none'), [ROOT], missingStat)).toBeNull();
  });

  it('빈 문자열·비문자열 입력과 빈 루트 목록은 거부한다', () => {
    expect(resolveOpenableDir('', [ROOT], dirStat)).toBeNull();
    expect(resolveOpenableDir('   ', [ROOT], dirStat)).toBeNull();
    expect(resolveOpenableDir(undefined as unknown as string, [ROOT], dirStat)).toBeNull();
    expect(resolveOpenableDir(path.join(ROOT, 'docs'), [undefined, ''], dirStat)).toBeNull();
  });
});

describe('resolveDialogPath', () => {
  it('상대 경로를 절대 경로로 정규화한다', () => {
    expect(path.isAbsolute(resolveDialogPath('a/b.csv'))).toBe(true);
  });
});
