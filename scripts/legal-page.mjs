// LICENSE · EULA.md · THIRD-PARTY-NOTICES.md를 랜딩 사이트용 한 페이지(docs/legal/index.html)로 만든다.
// 원문 파일이 유일한 기준이고 이 페이지는 생성물이다. 원문을 고친 뒤에는 `npm run build:legal`로 다시 만든다.
// (src/main/__tests__/legalPage.test.ts가 생성물이 원문과 어긋나면 실패한다.)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

export const LEGAL_PAGE_PATH = 'docs/legal/index.html';

// 원문끼리 서로 가리키는 상대 링크를 페이지 안의 해당 구역으로 바꾼다.
const INTERNAL_LINKS = {
  LICENSE: '#license',
  'EULA.md': '#eula',
  'THIRD-PARTY-NOTICES.md': '#notices',
};

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function markdownToHtml(markdown) {
  // 각 구역에 제목을 따로 달므로 원문의 최상위 제목(# ...)은 뺀다.
  const body = markdown.replace(/^# .*\n+/, '');
  const html = String(
    unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeStringify).processSync(body),
  );
  return html
    // 구역 제목이 h2이므로 원문 제목을 한 단계씩 내린다.
    .replace(/<(\/?)h([2-5])>/g, (_m, slash, level) => `<${slash}h${Number(level) + 1}>`)
    .replace(/href="([^"]+)"/g, (match, href) => (INTERNAL_LINKS[href] ? `href="${INTERNAL_LINKS[href]}"` : match))
    .replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"');
}

// LICENSE는 일반 텍스트다. 조항 제목·항목·들여쓴 설명을 구분해 읽기 쉬운 HTML로 바꾼다.
function licenseToHtml(text) {
  return text
    .trim()
    .split('\n')
    .map((line, index) => {
      if (!line.trim()) return '';
      if (/^─+$/.test(line)) return '<hr>';
      const html = escapeHtml(line.trim())
        .replace(/https?:\/\/[^\s<]+/g, url => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`)
        .replace(/THIRD-PARTY-NOTICES\.md/g, '<a href="#notices">THIRD-PARTY-NOTICES.md</a>')
        .replace(/EULA\.md/g, '<a href="#eula">EULA.md</a>');
      if (index === 0) return `<p class="license-name"><strong>${html}</strong></p>`;
      if (/^제\d+조 /.test(line) || /^English summary/.test(line)) return `<h3>${html}</h3>`;
      if (/^\d+\. /.test(line)) return `<p class="item">${html}</p>`;
      if (/^\s/.test(line)) return `<p class="indent">${html}</p>`;
      return `<p>${html}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

export function renderLegalPage(rootDir) {
  const read = name => readFileSync(resolve(rootDir, name), 'utf8').replace(/\r\n/g, '\n');
  const license = licenseToHtml(read('LICENSE'));
  const eula = markdownToHtml(read('EULA.md'));
  const notices = markdownToHtml(read('THIRD-PARTY-NOTICES.md'));

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EduNote 라이선스·이용약관</title>
<meta name="description" content="EduNote의 라이선스, 이용약관, 오픈소스 고지를 한곳에서 확인하세요.">
<meta name="theme-color" content="#FAF9F7">
<link rel="icon" type="image/png" href="../assets/icon.png">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" as="style" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<!-- 이 파일은 scripts/legal-page.mjs가 생성합니다. 직접 고치지 말고 LICENSE·EULA.md·THIRD-PARTY-NOTICES.md를 고친 뒤 npm run build:legal을 실행하세요. -->
<style>
  :root {
    --bg: #FAF9F7; --card: #FFFFFF; --border: #EDE8E1; --code-bg: #F5F3F0;
    --text: #1C1917; --text-2: #44403C; --text-3: #78716C; --text-4: #A8A29E;
    --accent: #D97706; --accent-bg: #FEF3C7;
    --shadow: 0 1px 2px rgba(28,25,23,0.04), 0 8px 24px rgba(28,25,23,0.06);
  }
  html.dark {
    --bg: #171210; --card: #221E1B; --border: #2E2822; --code-bg: #1B1714;
    --text: #F0EBE6; --text-2: #C4B8B0; --text-3: #9C8F87; --text-4: #6B5E57;
    --accent: #F59E0B; --accent-bg: rgba(217,119,6,0.18);
    --shadow: 0 1px 2px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.35);
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; scroll-padding-top: 76px; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', system-ui, sans-serif;
    line-height: 1.7; word-break: keep-all; overflow-wrap: break-word;
  }
  a { color: inherit; }
  .wrap { max-width: 860px; margin: 0 auto; padding: 0 24px; }

  .nav {
    position: sticky; top: 0; z-index: 20;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(10px); border-bottom: 1px solid var(--border);
  }
  .nav .wrap { display: flex; align-items: center; gap: 12px; padding-top: 12px; padding-bottom: 12px; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 17px; text-decoration: none; }
  .brand img { width: 30px; height: 30px; border-radius: 8px; }
  .nav-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
  .back { text-decoration: none; color: var(--text-3); font-size: 14px; font-weight: 600; padding: 8px 10px; border-radius: 8px; }
  .back:hover { color: var(--text); background: var(--border); }
  .icon-btn {
    width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--border);
    background: var(--card); display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--text-3); font-size: 16px;
  }

  header.page { padding: 48px 0 8px; }
  header.page h1 { font-size: clamp(26px, 4vw, 36px); font-weight: 900; letter-spacing: -0.02em; margin: 0 0 8px; }
  header.page p { color: var(--text-3); margin: 0; }

  .summary {
    margin: 28px 0 0; padding: 20px 22px; border-radius: 16px;
    background: var(--accent-bg); color: var(--text-2);
  }
  .summary h2 { font-size: 15px; margin: 0 0 8px; color: var(--accent); }
  .summary ul { margin: 0; padding-left: 20px; }
  .summary li { margin: 4px 0; }

  .tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 28px 0 0; }
  .tabs a {
    text-decoration: none; font-size: 14px; font-weight: 700; color: var(--text-2);
    padding: 8px 14px; border-radius: 999px; border: 1px solid var(--border); background: var(--card);
  }
  .tabs a:hover { border-color: var(--accent); color: var(--accent); }

  main section {
    margin: 28px 0; padding: 28px; border-radius: 20px;
    background: var(--card); border: 1px solid var(--border); box-shadow: var(--shadow);
  }
  main section > h2 { font-size: 22px; margin: 0 0 4px; }
  main section > .source { font-size: 13px; color: var(--text-4); margin: 0 0 20px; }
  .doc h3 { font-size: 18px; margin: 28px 0 8px; }
  .doc h4 { font-size: 16px; margin: 22px 0 6px; }
  .doc p, .doc li { color: var(--text-2); }
  .doc table { width: 100%; border-collapse: collapse; font-size: 14px; display: block; overflow-x: auto; }
  .doc th, .doc td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top; }
  .doc th { background: var(--code-bg); }
  .doc blockquote { margin: 0 0 16px; padding: 10px 16px; border-left: 3px solid var(--accent); color: var(--text-3); }
  .doc code { font-size: 0.9em; background: var(--code-bg); padding: 1px 5px; border-radius: 5px; }
  .doc pre {
    max-height: 360px; overflow: auto; padding: 14px 16px; border-radius: 12px;
    background: var(--code-bg); border: 1px solid var(--border); font-size: 12.5px; line-height: 1.55;
  }
  .doc pre code { background: none; padding: 0; }
  .doc hr { border: none; border-top: 1px solid var(--border); margin: 24px 0; }
  .license .license-name { margin-top: 0; }
  .license p.item { margin: 12px 0 4px; }
  .license p.indent { margin: 0 0 8px; padding-left: 1.4em; }
  .license p.item + p.item { margin-top: 4px; }

  footer { border-top: 1px solid var(--border); padding: 28px 0 40px; }
  footer p { margin: 0; font-size: 13px; color: var(--text-4); }

  @media (max-width: 640px) {
    .wrap { padding: 0 16px; }
    main section { padding: 20px 16px; border-radius: 16px; }
    header.page { padding-top: 32px; }
  }
</style>
</head>
<body>

<nav class="nav">
  <div class="wrap">
    <a class="brand" href="../"><img src="../assets/icon.png" alt="EduNote"> EduNote</a>
    <div class="nav-right">
      <a class="back" href="../">← 홈으로</a>
      <button class="icon-btn" id="themeToggle" type="button" aria-label="테마 전환">🌙</button>
    </div>
  </div>
</nav>

<div class="wrap">
  <header class="page">
    <h1>라이선스 · 이용약관</h1>
    <p>EduNote를 쓰기 전에 알아 두실 이용 조건을 한곳에 모았습니다.</p>
  </header>

  <div class="summary">
    <h2>한눈에 보기</h2>
    <ul>
      <li>공식 배포본은 개인·학교·교육기관이 <strong>무료로</strong> 사용할 수 있습니다. 교사의 학교 업무 사용도 포함됩니다.</li>
      <li>EduNote로 만든 문서와 기록의 권리는 <strong>사용자에게</strong> 있습니다. 최종 검토 책임도 사용자에게 있습니다.</li>
      <li>개발자는 서버를 운영하지 않으며 사용자·학생 정보를 <strong>수집하지 않습니다.</strong> 자료는 사용자 PC에 저장됩니다.</li>
      <li>무료 등급 Gemini API 키로 보낸 내용은 Google 서비스 개선에 쓰일 수 있습니다. 민감한 작업에는 유료 등급 키를 권장합니다.</li>
      <li>소스는 공개되어 있지만 오픈소스는 아닙니다. 재배포·판매·코드 차용에는 허락이 필요합니다.</li>
    </ul>
  </div>

  <nav class="tabs" aria-label="문서 바로가기">
    <a href="#license">라이선스</a>
    <a href="#eula">이용약관</a>
    <a href="#notices">오픈소스 고지</a>
  </nav>

  <main>
    <section id="license" class="doc license">
      <h2>라이선스</h2>
      <p class="source">EduNote 소스 공개 라이선스 · 원문: LICENSE</p>
${license}
    </section>

    <section id="eula" class="doc">
      <h2>이용약관</h2>
      <p class="source">EduNote 이용약관(최종 사용자 라이선스 계약) · 원문: EULA.md</p>
${eula}
    </section>

    <section id="notices" class="doc">
      <h2>오픈소스 고지</h2>
      <p class="source">EduNote에 포함된 오픈소스 구성요소와 라이선스 · 원문: THIRD-PARTY-NOTICES.md</p>
${notices}
    </section>
  </main>
</div>

<footer>
  <div class="wrap">
    <p>Copyright © 2026 Dustin. All rights reserved.</p>
  </div>
</footer>

<script>
(function () {
  var root = document.documentElement;
  var toggle = document.getElementById('themeToggle');
  function applyTheme(mode) {
    root.classList.toggle('dark', mode === 'dark');
    toggle.textContent = mode === 'dark' ? '☀️' : '🌙';
  }
  var saved = null;
  try { saved = localStorage.getItem('edunote-landing-theme'); } catch (e) {}
  var initial = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(initial);
  toggle.addEventListener('click', function () {
    var next = root.classList.contains('dark') ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('edunote-landing-theme', next); } catch (e) {}
  });
})();
</script>

</body>
</html>
`;
}

// `node scripts/legal-page.mjs`로 실행하면 페이지 파일을 다시 쓴다.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const outPath = resolve(rootDir, LEGAL_PAGE_PATH);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, renderLegalPage(rootDir), 'utf8');
  console.log(`생성: ${LEGAL_PAGE_PATH}`);
}
