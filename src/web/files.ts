// 웹판 파일 저장·열기. 데스크톱의 저장 대화상자 흐름을 최대한 그대로 따른다:
// - "저장할 때마다 위치 묻기"(alwaysAskPath)가 켜져 있고 브라우저가 지원하면(크롬·엣지) 다른 이름으로 저장 창을 띄운다.
// - 그 밖에는 브라우저 기본 다운로드로 저장한다.
// 반환값은 데스크톱처럼 "저장된 위치" 문자열이며, 렌더러의 완료 토스트에 그대로 표시된다.

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<{ name: string; createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }>;
};

const MIME_BY_EXT: Record<string, string> = {
  txt: 'text/plain',
  csv: 'text/csv',
  html: 'text/html',
  json: 'application/json',
  hwpx: 'application/hwp+zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  pdf: 'application/pdf',
  md: 'text/markdown',
};

export function extOf(name: string): string {
  const m = name.match(/\.([a-zA-Z0-9]{1,8})$/);
  return m ? m[1].toLowerCase() : '';
}

export function mimeOf(name: string): string {
  return MIME_BY_EXT[extOf(name)] ?? 'application/octet-stream';
}

// 파일 이름에 쓸 수 없는 문자를 바꾸고 길이를 제한한다(경로 구분자로 다른 위치를 노리는 이름 차단).
export function safeFileName(name: string, fallback: string): string {
  const cleaned = (name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim().slice(0, 180);
  return cleaned || fallback;
}

export const DOWNLOAD_LABEL = '다운로드 폴더';

function anchorDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 다운로드가 시작될 시간을 준 뒤 해제한다.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function saveBlob(blob: Blob, rawName: string, askLocation: boolean): Promise<string | null> {
  const name = safeFileName(rawName, `edunote_${Date.now()}`);
  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (askLocation && typeof picker === 'function') {
    try {
      const ext = extOf(name);
      const handle = await picker.call(window, {
        suggestedName: name,
        types: ext ? [{ description: ext.toUpperCase(), accept: { [mimeOf(name)]: [`.${ext}`] } }] : undefined,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return handle.name;
    } catch (e) {
      // 사용자가 취소하면 데스크톱처럼 null(저장 안 함)
      if ((e as { name?: string })?.name === 'AbortError') return null;
      // 형식 제한 등으로 창을 못 띄우면 일반 다운로드로 대신한다.
    }
  }
  anchorDownload(blob, name);
  return `${DOWNLOAD_LABEL}/${name}`;
}

// 파일 하나를 고르게 한다. 취소하면 null.
export function pickFile(accept: string): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
  if (!m) return null;
  const [, mime, isBase64, payload] = m;
  if (!isBase64) return new Blob([decodeURIComponent(payload)], { type: mime });
  const bin = atob(payload);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
