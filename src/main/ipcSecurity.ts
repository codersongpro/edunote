import * as path from 'path';
import { fileURLToPath } from 'url';

interface SenderFrameLike {
  url: string;
}

interface IpcSenderLike {
  mainFrame: SenderFrameLike;
}

interface IpcEventLike {
  sender: IpcSenderLike;
  senderFrame: SenderFrameLike | null;
}

function normalizeFilePath(url: URL): string {
  const resolved = path.resolve(fileURLToPath(url));
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/**
 * hash만 다른 EduNote 화면(#demo, #chat)은 같은 renderer 문서로 인정합니다.
 * protocol·host·path·query 중 하나라도 다르면 신뢰하지 않습니다.
 */
export function isTrustedRendererUrl(candidateUrl: string, trustedRendererUrl: string): boolean {
  try {
    const candidate = new URL(candidateUrl);
    const trusted = new URL(trustedRendererUrl);

    if (candidate.protocol !== trusted.protocol || candidate.search !== trusted.search) return false;

    if (trusted.protocol === 'file:') {
      return candidate.host === trusted.host
        && normalizeFilePath(candidate) === normalizeFilePath(trusted);
    }

    return candidate.origin === trusted.origin
      && candidate.pathname === trusted.pathname;
  } catch {
    return false;
  }
}

/** 권한 IPC는 신뢰한 EduNote 문서의 최상위 프레임에서만 받을 수 있습니다. */
export function isTrustedIpcSender(event: IpcEventLike, trustedRendererUrl: string): boolean {
  const senderFrame = event.senderFrame;
  if (!senderFrame || senderFrame !== event.sender.mainFrame) return false;
  return isTrustedRendererUrl(senderFrame.url, trustedRendererUrl);
}

export function assertTrustedIpcSender(event: IpcEventLike, trustedRendererUrl: string): void {
  if (!isTrustedIpcSender(event, trustedRendererUrl)) {
    throw new Error('허용되지 않은 화면의 요청입니다.');
  }
}
