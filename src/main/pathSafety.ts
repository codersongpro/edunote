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
