import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'docs/index.html'), 'utf8');
const landingPage = new DOMParser().parseFromString(html, 'text/html');

describe('랜딩페이지 외부 링크', () => {
  it('GitHub 보기와 프로필 링크는 숨기고 Windows 다운로드는 유지한다', () => {
    const linkLabels = Array.from(landingPage.querySelectorAll('a'))
      .map(link => link.textContent?.trim());

    expect(linkLabels).not.toContain('GitHub에서 보기');
    expect(linkLabels).not.toContain('GitHub 프로필');
    expect(landingPage.querySelector<HTMLAnchorElement>('#heroDownloadBtn')?.href)
      .toContain('/releases/download/');
    expect(landingPage.querySelector<HTMLAnchorElement>('#downloadBtn')?.href)
      .toContain('/releases/download/');
  });

  it('바닥글의 릴리즈 노트 전체와 오픈소스 라이선스 링크는 표시하지 않는다', () => {
    const footerLinks = Array.from(landingPage.querySelectorAll('footer a'))
      .map(link => link.textContent?.trim());

    expect(footerLinks).not.toContain('릴리즈 노트 전체');
    expect(footerLinks).not.toContain('오픈소스 라이선스');
    expect(landingPage.querySelector('footer p')?.textContent)
      .toContain('Copyright');
  });
});
