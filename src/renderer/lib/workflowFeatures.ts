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

export interface InstitutionFormat {
  id: string;
  docType: string;
  name: string;
  outline: string;
  bulletStyle: string;
  fontSize: number;
  endingStyle: string;
}

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

// 선택한 기관 서식을 생성 프롬프트에 넣을 문장으로 만든다.
// 저장하지 않고 화면에서 고쳐 쓴 값도 그대로 쓰이므로, 채운 항목만 넣고
// 목차·글머리표·문장 종결이 모두 비어 있으면 서식이 없는 것으로 본다
// (글자 크기만 남은 상태로 기본 서식 보정을 끄지 않기 위해서다).
export function buildInstitutionFormatInstruction(format: Partial<InstitutionFormat>): string {
  const outline = String(format.outline ?? '').trim();
  const bulletStyle = String(format.bulletStyle ?? '').trim();
  const endingStyle = String(format.endingStyle ?? '').trim();
  if (!outline && !bulletStyle && !endingStyle) return '';

  const name = String(format.name ?? '').trim();
  const fontSize = Number(format.fontSize);
  const lines = [
    name ? `서식명: ${name}` : '',
    outline ? `목차: ${outline}` : '',
    bulletStyle ? `글머리표: ${bulletStyle}` : '',
    Number.isFinite(fontSize) && fontSize > 0 ? `기본 글자 크기: ${fontSize}pt` : '',
    endingStyle ? `문장 종결: ${endingStyle}` : '',
  ];
  return lines.filter(Boolean).join('\n');
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
