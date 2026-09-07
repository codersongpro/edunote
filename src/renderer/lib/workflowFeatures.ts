export type GenerationItemStatus = 'idle' | 'running' | 'completed' | 'failed' | 'blocked';
export type ReviewStatus = 'draft' | 'reviewed' | 'final';

export interface RetryableStudent {
  id: string;
  generatedContent?: string;
  generationStatus?: GenerationItemStatus;
  reviewStatus?: ReviewStatus;
}

export interface EvidenceLink {
  id: string;
  sentence: string;
  sentenceIndex?: number;
  sentenceFingerprint?: string;
  sourceText: string;
  sourceLabel?: string;
  page?: number;
  confirmed: boolean;
}

export interface ActualExpense {
  id: string;
  paidAt: string;
  amount: number;
  memo: string;
}

export interface ResourceUsageRecord {
  id: string;
  usedAt: string;
  grade: string;
  unit: string;
  note: string;
}

export type DocumentCompareField = 'date' | 'time' | 'place' | 'target' | 'amount';

export interface DocumentComparisonItem {
  field: DocumentCompareField;
  label: string;
  leftValue: string;
  rightValue: string;
  leftExcerpt: string;
  rightExcerpt: string;
  status: 'match' | 'mismatch' | 'missing';
}

export interface InstitutionFormat {
  id: string;
  docType: string;
  name: string;
  outline: string;
  bulletStyle: string;
  fontSize: number;
  endingStyle: string;
}

const compareLabels: Record<DocumentCompareField, string> = {
  date: '날짜',
  time: '시간',
  place: '장소',
  target: '대상',
  amount: '금액',
};

const fieldMatchers: Record<DocumentCompareField, RegExp[]> = {
  date: [/(?:일시|날짜|기간)\s*[:：]?\s*([^\n]*(?:\d{4}[.년/-]\s*\d{1,2}[.월/-]\s*\d{1,2}(?:일)?)[^\n]*)/i, /(\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일)/],
  time: [/(?:일시|시간)\s*[:：]?\s*([^\n]*\d{1,2}\s*:\s*\d{2}[^\n]*)/i, /(\d{1,2}\s*:\s*\d{2}(?:\s*[~-]\s*\d{1,2}\s*:\s*\d{2})?)/],
  place: [/(?:장소|위치)\s*[:：]\s*([^\n]+)/i],
  target: [/(?:대상|참석 대상)\s*[:：]\s*([^\n]+)/i],
  amount: [/(?:금액|예산|비용|강사료)\s*[:：]?\s*([^\n]*\d[\d,]*\s*원[^\n]*)/i, /(\d[\d,]*\s*원)/],
};

const normalizedValue = (field: DocumentCompareField, value: string): string => {
  const base = value.toLowerCase().replace(/\s+/g, ' ').trim();
  if (field === 'amount') return base.replace(/[^0-9]/g, '');
  if (field === 'time') {
    const match = base.match(/\d{1,2}\s*:\s*\d{2}(?:\s*[~-]\s*\d{1,2}\s*:\s*\d{2})?/);
    return match?.[0].replace(/\s+/g, '') ?? base;
  }
  if (field === 'date') {
    const match = base.match(/\d{4}\D+\d{1,2}\D+\d{1,2}/);
    return match?.[0].replace(/\D+/g, '-') ?? base;
  }
  return base.replace(/[.,。]/g, '');
};

const extractField = (text: string, field: DocumentCompareField): { values: string[]; excerpts: string[] } => {
  const matches = text.split(/\r?\n/).flatMap(line => {
    for (const matcher of fieldMatchers[field]) {
      const match = line.match(matcher);
      if (!match) continue;
      return [{ value: (match[1] ?? match[0]).trim(), excerpt: match[0].trim() }];
    }
    return [];
  });
  const unique = matches.filter((item, index) => matches.findIndex(candidate => normalizedValue(field, candidate.value) === normalizedValue(field, item.value)) === index);
  return { values: unique.map(item => item.value), excerpts: unique.map(item => item.excerpt) };
};

export function retryableStudentIds(students: RetryableStudent[]): string[] {
  return students
    .filter(student => student.reviewStatus !== 'final')
    .filter(student => student.generationStatus !== 'blocked')
    .filter(student => student.generationStatus === 'failed' || !student.generatedContent?.trim())
    .map(student => student.id);
}

export function generationStatusForError(error: unknown): GenerationItemStatus {
  const message = String((error as { message?: string })?.message ?? error ?? '').toLocaleLowerCase('ko-KR');
  return message.includes('안전 정책') || message.includes('safety') ? 'blocked' : 'failed';
}

export function splitRecordSentences(text: string): string[] {
  return text
    .replace(/([.!?。])\s*/g, '$1\n')
    .split(/\n+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

export function buildDocumentComparison(
  left: string,
  right: string,
  fields: DocumentCompareField[],
): DocumentComparisonItem[] {
  return fields.map(field => {
    const leftItem = extractField(left, field);
    const rightItem = extractField(right, field);
    const leftNormalized = leftItem.values.map(value => normalizedValue(field, value)).sort();
    const rightNormalized = rightItem.values.map(value => normalizedValue(field, value)).sort();
    const status = leftNormalized.length === 0 || rightNormalized.length === 0
      ? 'missing'
      : JSON.stringify(leftNormalized) === JSON.stringify(rightNormalized)
        ? 'match'
        : 'mismatch';
    return {
      field,
      label: compareLabels[field],
      leftValue: leftItem.values.join(' / '),
      rightValue: rightItem.values.join(' / '),
      leftExcerpt: leftItem.excerpts.join('\n'),
      rightExcerpt: rightItem.excerpts.join('\n'),
      status,
    };
  });
}

export function calculateBudgetActuals(planned: number, expenses: ActualExpense[]) {
  const safePlanned = Number.isFinite(planned) ? planned : 0;
  const spent = expenses.reduce((sum, expense) => sum + (Number.isFinite(expense.amount) ? expense.amount : 0), 0);
  return { planned: safePlanned, spent, balance: safePlanned - spent };
}

export function filterResourceUsage(records: ResourceUsageRecord[], query: string): ResourceUsageRecord[] {
  const needle = query.trim().toLocaleLowerCase('ko-KR');
  if (!needle) return records;
  return records.filter(record => [record.grade, record.unit, record.note, record.usedAt]
    .some(value => value.toLocaleLowerCase('ko-KR').includes(needle)));
}

export function normalizeInstitutionFormat(raw: Record<string, unknown>): InstitutionFormat {
  const fontSize = Number(raw.fontSize);
  return {
    id: typeof raw.id === 'string' ? raw.id : `format-${Date.now()}`,
    docType: typeof raw.docType === 'string' ? raw.docType : '',
    name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : '',
    outline: typeof raw.outline === 'string' ? raw.outline.slice(0, 4000) : '',
    bulletStyle: typeof raw.bulletStyle === 'string' ? raw.bulletStyle.slice(0, 40) : '',
    fontSize: Number.isFinite(fontSize) ? Math.min(30, Math.max(8, fontSize)) : 13,
    endingStyle: typeof raw.endingStyle === 'string' ? raw.endingStyle.slice(0, 80) : '',
  };
}

export function contentFingerprint(content: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

const worksheetQuestionNodes = (document: Document): HTMLElement[] => {
  const primary = Array.from(document.querySelectorAll<HTMLElement>('.question, .activity'));
  if (primary.length > 0) return primary;
  const sections = Array.from(document.querySelectorAll<HTMLElement>('section'));
  if (sections.length > 0) return sections;
  return Array.from(document.querySelectorAll<HTMLElement>('h2, h3'));
};

export function ensureWorksheetQuestionIds(html: string, expectedCount: number): { html: string; questionIds: string[] } {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const nodes = worksheetQuestionNodes(document);
  if (expectedCount < 1 || nodes.length !== expectedCount) {
    throw new Error(`워크시트 문항 연결을 확인할 수 없습니다. 요청 ${expectedCount}개, 식별 ${nodes.length}개입니다.`);
  }
  const questionIds = nodes.map((node, index) => {
    const id = `q${index + 1}`;
    node.setAttribute('data-question-id', id);
    return id;
  });
  return { html: `<!DOCTYPE html>${document.documentElement.outerHTML}`, questionIds };
}

export function validateWorksheetVariantLinkage(sourceHtml: string, variantHtml: string): Array<{ sourceId: string; targetId: string }> {
  const sourceDocument = new DOMParser().parseFromString(sourceHtml, 'text/html');
  const variantDocument = new DOMParser().parseFromString(variantHtml, 'text/html');
  const sourceIds = Array.from(sourceDocument.querySelectorAll<HTMLElement>('[data-question-id]')).map(node => node.dataset.questionId ?? '');
  const variantIds = Array.from(variantDocument.querySelectorAll<HTMLElement>('[data-source-question-id]')).map(node => node.dataset.sourceQuestionId ?? '');
  if (sourceIds.length === 0 || sourceIds.length !== variantIds.length || sourceIds.some((id, index) => !id || id !== variantIds[index])) {
    throw new Error('변형본의 원본 문항 연결을 확인하지 못했습니다. 다시 생성해주세요.');
  }
  return sourceIds.map(sourceId => ({ sourceId, targetId: sourceId }));
}
