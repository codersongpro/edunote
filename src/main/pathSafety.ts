import * as path from 'path';

/**
 * 대화상자(showOpenDialog 등)에서 사용자가 직접 선택한 경로를 정규화한다.
 * 사용자가 OS 대화상자로 고른 파일이므로 추가 제한 없이 절대 경로로만 통일한다.
 */
export function resolveDialogPath(p: string): string {
  return path.resolve(p);
}

/**
 * resolved 경로가 root 자신이거나 root 하위 경로인지 검사한다.
 * 단순 startsWith 비교는 `/home/user`와 `/home/user-evil`을 구분하지 못하므로
 * path.relative 기반으로 경로 구분자 경계를 정확히 따진다.
 */
export function isPathInside(resolved: string, root: string): boolean {
  const rel = path.relative(path.resolve(root), resolved);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * 대화상자 없이 저장 폴더(saveDir)에 바로 쓰는 자동 저장 경로를 검증한다.
 * - 파일명에서 경로 구분자·예약 문자를 제거해 `../` 같은 탈출을 차단한다.
 * - 정규화 결과가 saveDir 내부의 파일 경로인지 확인한다.
 * 통과하면 절대 경로를, 아니면 null(대화상자 폴백)을 반환한다.
 */
export function resolveAutoSavePath(saveDir: string, suggestedName: string): string | null {
  if (typeof saveDir !== 'string' || !saveDir.trim()) return null;
  if (typeof suggestedName !== 'string') return null;
  // 경로 구분자·예약 문자를 제거하면 남는 이름에는 폴더 구분자가 없어 탈출이 불가능하다.
  const safeName = suggestedName.replace(/[\\/:*?"<>|]/g, '').trim();
  if (!safeName || safeName === '.' || safeName === '..') return null;
  const root = path.resolve(saveDir);
  const resolved = path.join(root, safeName);
  // 방어적 이중 확인: 결합 결과의 부모가 정확히 saveDir여야 한다.
  if (path.dirname(resolved) !== root) return null;
  return resolved;
}

/**
 * 폴더 열기(shell.openPath) 요청 경로를 검증한다.
 * - 허용된 루트(홈, userData, 저장 폴더 등) 하위여야 한다.
 * - 실제로 존재하는 "디렉터리"여야 한다. (파일을 openPath로 열면 실행될 수 있음)
 * 통과하면 정규화된 절대 경로를, 아니면 null을 반환한다.
 */
export function resolveOpenableDir(
  p: string,
  allowedRoots: Array<string | undefined>,
  statFn: (target: string) => { isDirectory(): boolean } | null,
): string | null {
  if (typeof p !== 'string' || !p.trim()) return null;
  const resolved = path.resolve(p);
  const roots = allowedRoots.filter((root): root is string => typeof root === 'string' && root.trim().length > 0);
  if (!roots.some(root => isPathInside(resolved, root))) return null;
  const stat = statFn(resolved);
  if (!stat || !stat.isDirectory()) return null;
  return resolved;
}
