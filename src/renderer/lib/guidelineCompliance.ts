import { ToastMessage } from '../types';

// 생활기록부 기재요령상 기재 불가·주의 대상 표현 감지.
// 프롬프트에 "쓰지 마세요"라고 지시하는 것과 별개로, 입력·출력에 섞여 들어온
// 표현을 기계적으로 한 번 더 걸러 교사가 검토하도록 경고한다 (차단이 아닌 안내).

export interface GuidelineViolation {
  category: string;
  term: string;
}

interface PatternGroup {
  category: string;
  patterns: RegExp[];
}

// '대상(大賞)'은 일반 단어 '대상(對象)'과 구분이 안 되므로 제외한다.
const PATTERN_GROUPS: PatternGroup[] = [
  {
    category: '교외 대회·수상',
    patterns: [
      /(?:전국|국제|교외)\s?[가-힣A-Za-z·\s]{0,12}?(?:대회|공모전|경시대회)/g,
      /올림피아드/g,
      /경시대회/g,
      /최우수상|우수상|금상|은상|동상|장려상|입상/g,
    ],
  },
  {
    category: '공인어학시험',
    patterns: [/토익|토플|텝스|아이엘츠|TOEIC|TOEFL|TEPS|IELTS|HSK|JLPT|DELF|DELE/gi],
  },
  {
    category: '특정 대학명',
    patterns: [/서울대|연세대|고려대|카이스트|KAIST|포스텍|POSTECH|성균관대|한양대|서강대|이화여대/g],
  },
  {
    category: '논문·출판·지식재산권',
    patterns: [/논문|학술지\s?게재|도서\s?출간|특허|지식재산권/g],
  },
  {
    category: '어학연수',
    patterns: [/어학연수|해외\s?연수/g],
  },
];

export function findGuidelineViolations(text: string): GuidelineViolation[] {
  const source = String(text ?? '');
  if (!source) return [];
  const found: GuidelineViolation[] = [];
  const seen = new Set<string>();
  for (const group of PATTERN_GROUPS) {
    for (const pattern of group.patterns) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        const term = match[0].trim();
        if (!term || seen.has(term)) continue;
        seen.add(term);
        found.push({ category: group.category, term });
      }
    }
  }
  return found;
}

// 일괄 생성 시 학생마다 토스트가 쏟아지지 않도록 1.5초 동안 모아 한 번에 알린다.
type ShowToast = (toast: Omit<ToastMessage, 'id'>) => void;

let pendingWarnings: Array<{ label: string; terms: string[] }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function queueViolationWarning(showToast: ShowToast, label: string, text: string): void {
  const violations = findGuidelineViolations(text);
  if (violations.length === 0) return;
  pendingWarnings.push({ label, terms: violations.map(v => v.term) });

  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    const summary = pendingWarnings
      .slice(0, 6)
      .map(w => `${w.label}(${w.terms.slice(0, 3).join('·')})`)
      .join(', ');
    const extra = pendingWarnings.length > 6 ? ` 외 ${pendingWarnings.length - 6}명` : '';
    showToast({
      type: 'warning',
      title: '기재요령 주의 표현 감지',
      description: `${summary}${extra} — 생활기록부에 기재할 수 없는 표현일 수 있으니 검토 후 사용하세요.`,
    });
    pendingWarnings = [];
    flushTimer = null;
  }, 1500);
}
