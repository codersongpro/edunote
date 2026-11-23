// 학생용 워크시트·평가지·퀴즈 문항을 AI 없이 코드로 점검하는 규칙.
// 정답 위치 쏠림, 정답만 유난히 긴 보기, 강조 없는 부정 질문처럼 형식으로 판단할 수 있는 것만 다룬다.
// 내용의 옳고 그름은 AI 독립 풀이 검증(geminiService.verifyLessonItems)이 맡는다.

export type ItemFindingSeverity = 'warning' | 'info';

export interface ItemFinding {
  // 화면에 보여 줄 문항 이름(예: "1번", "전체")
  item: string;
  category: string;
  severity: ItemFindingSeverity;
  message: string;
}

export interface QuizItem {
  type: 'multiple-choice' | 'short-answer' | 'ox';
  question: string;
  options?: string[];
  answer: string;
}

export interface WorksheetItem {
  id: string;
  text: string;
  html: string;
}

// "않은 것", "아닌 것", "틀린 것", "옳지 않은" 같은 부정 질문
const NEGATIVE_STEM = /(않은|아닌|틀린|없는|잘못된|옳지\s?않|맞지\s?않|해당하지\s?않)\s*(?:것|말|설명|내용|사람|문장|까닭|예)?/;
const CATCH_ALL_OPTION = /^(?:위\s*)?(?:보기\s*)?(?:모두|전부)\s*(?:옳|맞|정답|틀)|^(?:정답|답)\s*(?:이\s*)?없음|^알\s*수\s*없/;
const OPTION_MARKER = /^\s*(?:[①-⑩]|\(?[1-9]\)|[1-9][.)]|[ㄱ-ㅎ][.)])\s*/;

const label = (index: number) => `${index + 1}번`;
const visibleLength = (text: string) => text.replace(/\s+/g, '').length;
const normalizeStemStart = (text: string) => text.replace(/^\s*(?:\d+[.)]|[①-⑩]|문제\s*\d+[.:]?)\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 8);

// 2문장 이상이거나 어절 수가 많은 질문은 저학년이 읽기 어렵다. 가장 긴 문장 길이(공백 제외)를 잰다.
function longestSentence(text: string): number {
  return Math.max(0, ...text.split(/[.?!。]\s*|\n/).map(visibleLength));
}

function gradeSentenceLimit(grade: string): number | null {
  if (!grade.includes('초등')) return null;
  const year = Number(grade.match(/(\d+)\s*학년/)?.[1] ?? 0);
  if (year > 0 && year <= 2) return 30;
  if (year > 0 && year <= 4) return 45;
  return 60;
}

function checkStemRepetition(stems: string[], findings: ItemFinding[]): void {
  const counts = new Map<string, number[]>();
  stems.forEach((stem, index) => {
    const start = normalizeStemStart(stem);
    if (start.length < 4) return;
    counts.set(start, [...(counts.get(start) ?? []), index]);
  });
  for (const [start, indexes] of counts) {
    if (indexes.length >= 3) {
      findings.push({
        item: indexes.map(label).join(', '), category: '문항 다양성', severity: 'info',
        message: `${indexes.length}개 문항이 "${start}…"로 똑같이 시작합니다. 묻는 방식을 다양하게 바꾸면 집중이 덜 흐트러집니다.`,
      });
    }
  }
}

function checkSentenceLength(stems: string[], grade: string, findings: ItemFinding[]): void {
  const limit = gradeSentenceLimit(grade);
  if (!limit) return;
  stems.forEach((stem, index) => {
    const longest = longestSentence(stem);
    if (longest > limit) {
      findings.push({
        item: label(index), category: '읽기 부담', severity: 'info',
        message: `한 문장이 ${longest}자(공백 제외)입니다. ${grade}은 ${limit}자 안쪽으로 나누면 읽기 쉽습니다.`,
      });
    }
  });
}

function checkOptions(options: string[], index: number, findings: ItemFinding[], answer?: string): void {
  const cleaned = options.map(option => option.replace(OPTION_MARKER, '').trim());
  cleaned.forEach(option => {
    if (CATCH_ALL_OPTION.test(option)) {
      findings.push({
        item: label(index), category: '보기 구성', severity: 'warning',
        message: `"${option}" 같은 보기는 다른 보기의 정답 여부로 답이 정해져 변별력이 떨어집니다. 내용이 있는 보기로 바꿔 주세요.`,
      });
    }
  });
  if (new Set(cleaned.map(option => option.replace(/\s+/g, ''))).size !== cleaned.length) {
    findings.push({ item: label(index), category: '보기 구성', severity: 'warning', message: '같은 내용의 보기가 두 번 이상 나옵니다.' });
  }
  if (answer === undefined) return;
  const answerAt = cleaned.findIndex(option => option === answer.replace(OPTION_MARKER, '').trim());
  if (answerAt === -1) return;
  const lengths = cleaned.map(visibleLength);
  const others = lengths.filter((_, i) => i !== answerAt);
  const otherAverage = others.reduce((sum, n) => sum + n, 0) / Math.max(1, others.length);
  if (lengths[answerAt] >= 8 && lengths[answerAt] > otherAverage * 1.6 && lengths[answerAt] === Math.max(...lengths)) {
    findings.push({
      item: label(index), category: '정답 단서', severity: 'warning',
      message: '정답 보기만 다른 보기보다 눈에 띄게 깁니다. 학생이 내용을 몰라도 길이로 정답을 고를 수 있으니 보기 길이를 비슷하게 맞춰 주세요.',
    });
  }
}

// 객관식 정답 번호가 한쪽에 몰렸는지 본다. 4문항 이상일 때만 판단한다.
function checkAnswerPositions(positions: Array<{ index: number; position: number }>, findings: ItemFinding[]): void {
  if (positions.length < 4) return;
  const counts = new Map<number, number>();
  positions.forEach(({ position }) => counts.set(position, (counts.get(position) ?? 0) + 1));
  const [topPosition, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCount / positions.length >= 0.6) {
    findings.push({
      item: '전체', category: '정답 위치', severity: 'warning',
      message: `객관식 ${positions.length}문항 중 ${topCount}문항의 정답이 ${topPosition + 1}번 보기입니다. 정답 위치를 고르게 섞어 주세요.`,
    });
  }
  let run = 1;
  for (let i = 1; i < positions.length; i++) {
    run = positions[i].position === positions[i - 1].position ? run + 1 : 1;
    if (run === 3) {
      findings.push({
        item: positions.slice(i - 2, i + 1).map(p => label(p.index)).join(', '), category: '정답 위치', severity: 'info',
        message: `세 문항 연속으로 정답이 ${positions[i].position + 1}번 보기입니다.`,
      });
    }
  }
}

export function checkQuizItems(items: QuizItem[], grade = ''): ItemFinding[] {
  const findings: ItemFinding[] = [];
  const positions: Array<{ index: number; position: number }> = [];
  items.forEach((item, index) => {
    if (NEGATIVE_STEM.test(item.question)) {
      findings.push({
        item: label(index), category: '부정 질문', severity: 'info',
        message: '부정 질문입니다. 퀴즈 화면에서는 강조 표시가 없으므로 "옳지 않은"처럼 부정어가 눈에 띄도록 질문을 다듬거나 긍정 질문으로 바꿔 주세요.',
      });
    }
    if (item.type === 'multiple-choice' && item.options) {
      checkOptions(item.options, index, findings, item.answer);
      const position = item.options.indexOf(item.answer);
      if (position >= 0) positions.push({ index, position });
    }
  });
  const ox = items.filter(item => item.type === 'ox');
  if (ox.length >= 4) {
    const oCount = ox.filter(item => item.answer === 'O').length;
    if (oCount === 0 || oCount === ox.length) {
      findings.push({ item: '전체', category: '정답 위치', severity: 'warning', message: `OX ${ox.length}문항의 정답이 모두 ${oCount ? 'O' : 'X'}입니다.` });
    }
  }
  checkAnswerPositions(positions, findings);
  checkStemRepetition(items.map(item => item.question), findings);
  checkSentenceLength(items.map(item => item.question), grade, findings);
  return findings;
}

// 학생용 워크시트 HTML에서 data-question-id가 붙은 문항을 꺼낸다(ensureWorksheetQuestionIds 이후 상태).
export function extractWorksheetItems(html: string): WorksheetItem[] {
  const document = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(document.querySelectorAll<HTMLElement>('[data-question-id]')).map(node => ({
    id: node.dataset.questionId ?? '',
    text: (node.innerText ?? node.textContent ?? '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim(),
    html: node.innerHTML,
  }));
}

// 부정어가 <strong>·<b>·<u>·<em> 안에 있거나 굵게·밑줄 스타일이면 강조된 것으로 본다.
function negativeIsEmphasized(html: string): boolean {
  const document = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const emphasized = Array.from(document.querySelectorAll<HTMLElement>('strong, b, u, em, [style*="bold"], [style*="underline"], [style*="font-weight"]'));
  return emphasized.some(node => NEGATIVE_STEM.test(node.textContent ?? '') || /않|아닌|틀린|없는|잘못/.test(node.textContent ?? ''));
}

function worksheetOptionLines(text: string): string[] {
  return text.split('\n').flatMap(line => line.split(/(?=[①-⑩])/)).map(line => line.trim()).filter(line => /^[①-⑩]/.test(line));
}

export function checkWorksheetItems(html: string, options: { includeScore: boolean; grade: string }): ItemFinding[] {
  const findings: ItemFinding[] = [];
  const items = extractWorksheetItems(html);
  items.forEach((item, index) => {
    const stem = item.text.split('\n')[0] ?? item.text;
    if (NEGATIVE_STEM.test(stem) && !negativeIsEmphasized(item.html)) {
      findings.push({
        item: label(index), category: '부정 질문', severity: 'warning',
        message: '부정 질문인데 부정어가 강조되지 않았습니다. "옳지 않은"처럼 굵게나 밑줄로 표시해 주세요.',
      });
    }
    const optionLines = worksheetOptionLines(item.text);
    if (optionLines.length >= 3) checkOptions(optionLines, index, findings);
  });

  if (options.includeScore) {
    const scores = items.map(item => Number(item.text.match(/[(\[]\s*(\d{1,3})\s*점\s*[)\]]/)?.[1] ?? NaN));
    const missing = scores.map((score, index) => (Number.isNaN(score) ? label(index) : '')).filter(Boolean);
    if (missing.length) {
      findings.push({ item: missing.join(', '), category: '배점', severity: 'warning', message: '배점이 표시되지 않았습니다.' });
    } else {
      const sum = scores.reduce((total, score) => total + score, 0);
      const declared = Number(html.replace(/<[^>]+>/g, ' ').match(/총\s*점\s*[:：]?\s*(\d{1,3})\s*점|(\d{1,3})\s*점\s*만\s*점/)?.slice(1).find(Boolean) ?? NaN);
      if (!Number.isNaN(declared) && declared !== sum) {
        findings.push({ item: '전체', category: '배점', severity: 'warning', message: `문항별 배점 합계(${sum}점)가 총점(${declared}점)과 다릅니다.` });
      }
    }
  }

  checkStemRepetition(items.map(item => item.text.split('\n')[0] ?? ''), findings);
  checkSentenceLength(items.map(item => item.text.split('\n')[0] ?? ''), options.grade, findings);
  return findings;
}

// 퀴즈 HTML(buildQuizHtml 결과)에 담긴 문항 데이터를 다시 읽는다. 교사가 HTML을 고친 뒤에도 점검할 수 있게 한다.
export function extractQuizItems(html: string): QuizItem[] | null {
  const match = html.match(/var Q=(\[[\s\S]*?\]);\s*\n/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1].replace(/<\\\/script>/gi, '</script>'));
    return Array.isArray(data) ? data as QuizItem[] : null;
  } catch {
    return null;
  }
}

// 단답형 비교용: 띄어쓰기·문장부호·대소문자 차이는 같은 답으로 본다.
export function normalizeAnswer(value: string): string {
  return value.normalize('NFC').toLowerCase().replace(/[\s.,·!?'"“”‘’()[\]{}~\-]/g, '');
}
