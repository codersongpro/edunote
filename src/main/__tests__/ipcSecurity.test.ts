import { describe, expect, it } from 'vitest';
import { isTrustedIpcSender, isTrustedRendererUrl } from '../ipcSecurity';

describe('isTrustedRendererUrl', () => {
  it('패키지 앱의 정확한 renderer 파일과 hash만 허용한다', () => {
    const trusted = 'file:///C:/Program%20Files/EduNote/resources/app.asar/out/renderer/index.html';

    expect(isTrustedRendererUrl(`${trusted}#chat`, trusted)).toBe(true);
    expect(isTrustedRendererUrl('file:///C:/Users/Public/attacker.html', trusted)).toBe(false);
    expect(isTrustedRendererUrl(`${trusted}/../attacker.html`, trusted)).toBe(false);
  });

  it('개발 서버의 정확한 origin과 경로만 허용한다', () => {
    const trusted = 'http://127.0.0.1:5173/app/index.html';

    expect(isTrustedRendererUrl(`${trusted}#demo`, trusted)).toBe(true);
    expect(isTrustedRendererUrl('http://127.0.0.1:5173/admin', trusted)).toBe(false);
    expect(isTrustedRendererUrl('http://localhost:5173/app/index.html', trusted)).toBe(false);
  });
});

describe('isTrustedIpcSender', () => {
  it('신뢰한 renderer의 최상위 프레임만 허용한다', () => {
    const mainFrame = { url: 'file:///C:/app/out/renderer/index.html#chat' };
    const sender = { mainFrame };
    const trusted = 'file:///C:/app/out/renderer/index.html';

    expect(isTrustedIpcSender({ sender, senderFrame: mainFrame }, trusted)).toBe(true);
    expect(isTrustedIpcSender({ sender, senderFrame: { url: mainFrame.url } }, trusted)).toBe(false);
  });

  it('senderFrame이 없거나 다른 renderer 파일이면 거부한다', () => {
    const trusted = 'file:///C:/app/out/renderer/index.html';
    const mainFrame = { url: 'file:///C:/tmp/attacker.html' };
    const sender = { mainFrame };

    expect(isTrustedIpcSender({ sender, senderFrame: null }, trusted)).toBe(false);
    expect(isTrustedIpcSender({ sender, senderFrame: mainFrame }, trusted)).toBe(false);
  });
});
