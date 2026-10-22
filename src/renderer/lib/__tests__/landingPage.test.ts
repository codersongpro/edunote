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

  it('누적 다운로드 수는 집계 전까지 숨기고 릴리즈 전체 목록에서 계산한다', () => {
    expect(landingPage.querySelector<HTMLElement>('#downloadCount')?.hidden).toBe(true);
    expect(html).toContain('/releases?per_page=100&page=');
    expect(html).toContain('download_count');
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

describe('랜딩페이지 버전·새 기능 알림', () => {
  const version = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')).version as string;

  it('다운로드 기본 링크와 버전 표시가 package.json 버전과 같다', () => {
    const file = `/releases/download/v${version}/edunote_${version}_portable.exe`;
    expect(landingPage.querySelector<HTMLAnchorElement>('#heroDownloadBtn')?.href).toContain(file);
    expect(landingPage.querySelector<HTMLAnchorElement>('#downloadBtn')?.href).toContain(file);
    expect(landingPage.querySelector('#versionPill')?.textContent).toContain(`v${version}`);
    expect(landingPage.querySelector('#downloadMeta')?.textContent).toContain(`edunote_${version}_portable.exe`);
  });

  it('히어로 배지와 새 기능 섹션으로 v1.29.0 기능을 알린다', () => {
    expect(landingPage.querySelector<HTMLAnchorElement>('#whatsNewBadge')?.getAttribute('href')).toBe('#whats-new');
    const titles = Array.from(landingPage.querySelectorAll('#whats-new .feature-card h3')).map(h => h.textContent?.trim());
    expect(titles).toEqual(['전년도 공문 현행화', '공문·계획서 오류 검토', '결과 화면 AI 오류 검토']);
  });
});

describe('만든 사람 카드', () => {
  it('개발자 홈페이지(songpro.app)를 새 창으로 연결한다', () => {
    const link = landingPage.querySelector<HTMLAnchorElement>('#developer #devHomeLink');
    expect(link?.getAttribute('href')).toBe('https://songpro.app');
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toContain('noopener');
  });
});
