// 데스크톱용 HWPX 저장 래퍼. 문서 생성 로직은 hwpxDocument.ts에 있고(웹판과 공유),
// 여기서는 Buffer 변환과 파일 쓰기만 한다.
import * as fs from 'fs';
import * as path from 'path';
import { buildHwpxBytes, type HwpxMetadata } from './hwpxDocument';

export async function buildHwpxZip(title: string, content: string, meta: HwpxMetadata): Promise<Buffer> {
  return Buffer.from(await buildHwpxBytes(title, content, meta));
}

export async function generateHwpx(
  templateName: string,
  content: string,
  meta: HwpxMetadata,
  savePath: string,
): Promise<void> {
  const title = meta.title || templateName;
  const buf = await buildHwpxZip(title, content, meta);
  const dir = path.dirname(savePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(savePath, buf);
}
