import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

/**
 * 대상 파일과 같은 폴더에 먼저 쓴 뒤 rename으로 교체합니다.
 * 직렬화·쓰기 도중 오류가 나면 기존 파일은 그대로 남습니다.
 */
export function atomicWriteFileSync(
  targetPath: string,
  data: string | NodeJS.ArrayBufferView,
  encoding?: BufferEncoding,
): void {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = path.join(dir, `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`);

  try {
    if (typeof data === 'string') fs.writeFileSync(tempPath, data, encoding ?? 'utf8');
    else fs.writeFileSync(tempPath, data);

    // Windows에서는 읽기 전용 핸들의 fsync가 EPERM이 될 수 있어 읽기·쓰기 핸들을 사용합니다.
    const fd = fs.openSync(tempPath, 'r+');
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tempPath, targetPath);
  } finally {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch { /* 다음 실행에서 덮어쓰지 않는 고유 임시 파일입니다. */ }
    }
  }
}

export function atomicWriteJsonSync(targetPath: string, value: unknown): void {
  // 직렬화를 파일 생성보다 먼저 수행해 순환 참조 등 오류가 기존 파일에 영향을 주지 않게 합니다.
  const json = JSON.stringify(value, null, 2);
  atomicWriteFileSync(targetPath, json, 'utf8');
}
