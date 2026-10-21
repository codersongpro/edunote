// 현행화·오류 검토 화면의 입력(업로드 파일·캡처·붙여넣은 글)을 검토용 노드로 정리한다.
// 우선순위: HWPX 파일(서식 유지 저장 가능) → 붙여넣은 글 → 이미지·PDF 등(AI가 글자를 읽음)

import type { FileData } from '../types';
import { extractHwpxTextNodes } from './hwpx-parser';
import { textToNodes } from './aiReview';

export type DocSourceKind = 'hwpx' | 'text' | 'files';

export interface ResolvedDocSource {
  kind: DocSourceKind;
  /** 'files'일 때는 비어 있고, AI가 글자를 옮겨 적은 줄로 채워진다 */
  nodes: string[];
  /** 'files'일 때 AI에 보낼 첨부 */
  files: FileData[];
  hwpxFile?: File;
  fileName: string;
  notice?: string;
}

const isHwpx = (f: FileData) => f.file.name.toLowerCase().endsWith('.hwpx');
const isLegacyHwp = (f: FileData) => f.file.name.toLowerCase().endsWith('.hwp');

export function describeDocSource(files: FileData[], pastedText: string): string {
  if (files.some(isHwpx)) return 'HWPX 파일 · 원본 서식을 유지한 채 고쳐 저장할 수 있습니다';
  if (pastedText.trim()) return '붙여넣은 글 · 고친 글을 복사·저장할 수 있습니다';
  if (files.length > 0) return '이미지·PDF · AI가 글자를 읽어 검토합니다(원본 파일은 고칠 수 없음)';
  return '';
}

export async function resolveDocSource(files: FileData[], pastedText: string): Promise<ResolvedDocSource> {
  const hwpx = files.find(isHwpx);
  if (hwpx) {
    const nodes = await extractHwpxTextNodes(hwpx.file).catch(() => {
      throw new Error('HWPX 파일을 읽지 못했습니다. 한글에서 다시 저장한 뒤 올려 주세요.');
    });
    if (!nodes.some(node => node.trim())) throw new Error('HWPX 파일에서 글자를 찾지 못했습니다. 본문이 그림으로만 되어 있을 수 있습니다.');
    return {
      kind: 'hwpx',
      nodes,
      files: [],
      hwpxFile: hwpx.file,
      fileName: hwpx.file.name.replace(/\.hwpx$/i, ''),
      notice: files.length > 1 ? '여러 파일 중 HWPX 파일 하나만 검토합니다.' : undefined,
    };
  }
  if (pastedText.trim()) {
    return { kind: 'text', nodes: textToNodes(pastedText), files: [], fileName: '붙여넣은_문서' };
  }
  if (files.some(isLegacyHwp)) {
    throw new Error('구형 HWP 파일은 읽을 수 없습니다. 한글에서 "다른 이름으로 저장 → HWPX" 또는 PDF로 바꿔 올려 주세요.');
  }
  if (files.length === 0) throw new Error('검토할 파일을 올리거나 화면을 캡처해 붙여넣거나, 글을 붙여넣어 주세요.');
  return {
    kind: 'files',
    nodes: [],
    files,
    fileName: files[0].file.name.replace(/\.[^.]+$/, ''),
  };
}

export function safeFileName(name: string, fallback: string): string {
  return (name || fallback).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 60) || fallback;
}

// ─── 현행화 결과를 오류 검토 화면으로 넘기기 ─────────────────────────────

export const DOC_REVIEW_HANDOFF_EVENT = 'edunote-goto-doc-review';

let pendingHandoff: { files: FileData[]; text: string } | null = null;

export function sendToDocReview(payload: { files: FileData[]; text: string }): void {
  pendingHandoff = payload;
  window.dispatchEvent(new CustomEvent(DOC_REVIEW_HANDOFF_EVENT));
}

export function takeDocReviewHandoff(): { files: FileData[]; text: string } | null {
  const payload = pendingHandoff;
  pendingHandoff = null;
  return payload;
}
