import type { CustomTool, CustomToolInput } from '../types';

const MAX_IMPORTED_HTML_LENGTH = 250_000;
const MAX_IMPORTED_JSON_LENGTH = 500_000;

const DANGEROUS_HTML_PATTERNS = [
  /<object\b/i,
  /<embed\b/i,
  /javascript:/i,
  /data:text\/html/i,
];

export function isSafeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function sanitizeHtml(html: string): string {
  const source = String(html ?? '');
  if (typeof DOMParser === 'undefined') {
    return source
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\s(?:href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, '');
  }

  const parser = new DOMParser();
  const stripUnsafe = (root: ParentNode) => {
    root.querySelectorAll('script, iframe, object, embed, link, meta').forEach(node => node.remove());
    root.querySelectorAll('*').forEach((node) => {
      Array.from(node.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim().toLowerCase();
        if (
          name.startsWith('on') ||
          ((name === 'href' || name === 'src' || name === 'xlink:href') &&
            (value.startsWith('javascript:') || value.startsWith('data:text/html')))
        ) {
          node.removeAttribute(attr.name);
        }
      });
    });
  };

  // AI가 <!DOCTYPE html>·<html>·<head>·<body>를 포함한 전체 문서를 만든 경우, 이를
  // <div>로 감싸 파싱하면 브라우저가 중첩된 html/head/body 태그를 일반 자식 요소로 넣지 않고
  // 특수 처리해 버려(예: <title>이 본문에 낱개 요소로 새어 나옴) 구조가 흐트러진다.
  // 이런 문서는 그대로 파싱해 <head>의 <style>과 <body> 내용만 추출해 이어붙인다.
  if (/<html[\s>]/i.test(source) || /<!DOCTYPE\s+html/i.test(source)) {
    const fullDoc = parser.parseFromString(source, 'text/html');
    stripUnsafe(fullDoc);
    const styles = Array.from(fullDoc.head?.querySelectorAll('style') ?? [])
      .map(style => style.outerHTML)
      .join('');
    return styles + (fullDoc.body?.innerHTML ?? '');
  }

  const doc = parser.parseFromString(`<div>${source}</div>`, 'text/html');
  stripUnsafe(doc);

  return doc.body.firstElementChild?.innerHTML ?? '';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isValidInput(value: unknown): value is CustomToolInput {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    ['text', 'textarea', 'file-upload'].includes(String(value.type)) &&
    (value.placeholder === undefined || typeof value.placeholder === 'string') &&
    (value.required === undefined || typeof value.required === 'boolean')
  );
}

export function validateImportedTool(value: unknown): { ok: true; tool: CustomTool } | { ok: false; reason: string } {
  if (!isPlainObject(value)) return { ok: false, reason: '도구 형식이 올바르지 않습니다.' };
  if (typeof value.name !== 'string' || !value.name.trim()) return { ok: false, reason: '도구 이름이 없습니다.' };
  if (typeof value.description !== 'string') return { ok: false, reason: '도구 설명이 없습니다.' };
  if (!['admin', 'lesson', 'student', 'other'].includes(String(value.category))) return { ok: false, reason: '도구 분류가 올바르지 않습니다.' };
  if (!Array.isArray(value.inputs) || !value.inputs.every(isValidInput)) return { ok: false, reason: '입력 항목 형식이 올바르지 않습니다.' };
  if (typeof value.promptTemplate !== 'string') return { ok: false, reason: '프롬프트 템플릿이 없습니다.' };

  const toolType = value.toolType === 'html-app' ? 'html-app' : 'prompt';
  if (toolType === 'html-app') {
    if (typeof value.htmlContent !== 'string' || !value.htmlContent.trim()) return { ok: false, reason: 'HTML 앱 코드가 없습니다.' };
    if (value.htmlContent.length > MAX_IMPORTED_HTML_LENGTH) return { ok: false, reason: 'HTML 앱 코드가 너무 큽니다.' };
    if (DANGEROUS_HTML_PATTERNS.some(pattern => pattern.test(value.htmlContent as string))) {
      return { ok: false, reason: '허용되지 않는 HTML 실행 요소가 포함되어 있습니다.' };
    }
  }

  return { ok: true, tool: { ...value, toolType } as unknown as CustomTool };
}

export function parseImportedTools(raw: string): { tools: CustomTool[]; error?: string } {
  if (raw.length > MAX_IMPORTED_JSON_LENGTH) return { tools: [], error: '가져올 JSON 파일이 너무 큽니다.' };
  try {
    const parsed = JSON.parse(raw);
    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    const tools: CustomTool[] = [];
    for (const candidate of candidates) {
      const result = validateImportedTool(candidate);
      if (result.ok === false) return { tools: [], error: result.reason };
      tools.push(result.tool);
    }
    return { tools };
  } catch {
    return { tools: [], error: '유효한 JSON 파일이 아닙니다.' };
  }
}
