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
});
