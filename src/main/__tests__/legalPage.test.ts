import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — 타입 선언이 없는 생성 스크립트(.mjs)
import { LEGAL_PAGE_PATH, renderLegalPage } from '../../../scripts/legal-page.mjs';

const rootDir = process.cwd();
// Windows 체크아웃(core.autocrlf)에서는 줄바꿈이 CRLF로 바뀌므로 비교 전에 LF로 맞춘다.
const committed = readFileSync(resolve(rootDir, LEGAL_PAGE_PATH), 'utf8').replace(/\r\n/g, '\n');
const page = new DOMParser().parseFromString(committed, 'text/html');

describe('라이선스·이용약관 웹페이지', () => {
  it('LICENSE·EULA.md·THIRD-PARTY-NOTICES.md 원문과 일치한다 (어긋나면 npm run build:legal 실행)', () => {
    expect(committed).toBe(renderLegalPage(rootDir));
  });

  it('세 문서를 각각의 구역으로 담고 바로가기로 연결한다', () => {
    for (const id of ['license', 'eula', 'notices']) {
      expect(page.getElementById(id), id).not.toBeNull();
      expect(page.querySelector(`.tabs a[href="#${id}"]`), id).not.toBeNull();
    }
    expect(page.querySelector('#license')?.textContent).toContain('EduNote 소스 공개 라이선스');
    expect(page.querySelector('#eula')?.textContent).toContain('제6조 (스킬마켓)');
    expect(page.querySelector('#notices')?.textContent).toContain('Apache License');
  });

  it('원문끼리의 상대 링크를 페이지 안 구역으로 바꾼다', () => {
    const hrefs = Array.from(page.querySelectorAll('main a')).map(a => a.getAttribute('href'));
    expect(hrefs).not.toContain('LICENSE');
    expect(hrefs).not.toContain('EULA.md');
    expect(hrefs).toContain('#license');
  });
});

describe('랜딩페이지와 앱의 법적 고지 링크', () => {
  const landing = new DOMParser().parseFromString(
    readFileSync(resolve(rootDir, 'docs/index.html'), 'utf8'),
    'text/html',
  );

  it('랜딩페이지는 GitHub 대신 사이트 안의 라이선스 페이지로 연결한다', () => {
    const hrefs = Array.from(landing.querySelectorAll('a')).map(a => a.getAttribute('href') ?? '');
    expect(hrefs).toEqual(expect.arrayContaining(['legal/#license', 'legal/#eula', 'legal/#notices']));
    expect(hrefs.filter(href => href.includes('github.com/codersongpro/edunote/blob'))).toEqual([]);
  });

  it('앱 화면도 같은 페이지를 연다', () => {
    for (const file of ['src/renderer/components/AboutScreen.tsx', 'src/renderer/components/MyToolsScreen.tsx']) {
      const source = readFileSync(resolve(rootDir, file), 'utf8');
      expect(source, file).not.toContain('github.com/codersongpro/edunote/blob');
      expect(source, file).toContain('https://ednote.vercel.app/legal/');
    }
  });
});
