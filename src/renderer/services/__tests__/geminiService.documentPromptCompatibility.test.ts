import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocType, GongmunComplexity } from '../../types';
import { generateDocument } from '../geminiService';

const aiGenerateMultipart = vi.fn();

beforeEach(() => {
  aiGenerateMultipart.mockReset();
  aiGenerateMultipart.mockResolvedValue({ text: '<div>문서</div>', model: 'gemini-test', fallbacks: [] });
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { aiGenerateMultipart },
  });
});

async function captureDocumentPrompt(
  docType: DocType,
  promptContext = '[작성 내용]: 테스트',
  pageCount = 1,
  templateText = '',
  savedFormatText = '',
): Promise<{ system: string; user: string; combined: string }> {
  await generateDocument(
    docType,
    promptContext,
    undefined,
    pageCount,
    '2026',
    [],
    [],
    templateText,
    GongmunComplexity.MEDIUM,
    undefined,
    undefined,
    false,
    undefined,
    savedFormatText,
  );
  const [parts, system] = aiGenerateMultipart.mock.calls.at(-1) as [Array<{ text?: string }>, string];
  const user = parts.map(part => part.text ?? '').join('\n');
  return { system, user, combined: `${system}\n${user}` };
}

describe('문서 유형별 최종 프롬프트 호환성', () => {
  it.each([
    [DocType.GONGMUN, '교육행정 공문서'],
    [DocType.PLAN, '세부 운영 계획서'],
    [DocType.TRAINING_MATERIAL, '교직원 대상 연수자료'],
    [DocType.REPORT, '사업 결과 보고서'],
    [DocType.NEWSLETTER, '가정통신문'],
    [DocType.MESSAGE, '문자 작성'],
    [DocType.PUMUI, '지출품의서'],
    [DocType.MEETING_MINUTES, '협의회 회의록'],
    [DocType.PROMOTION, '홍보자료 및 보도자료'],
    [DocType.GONGGO, '학교 공고문'],
  ])('%s 요청에는 해당 문서 목적이 남는다', async (docType, purpose) => {
    const { user } = await captureDocumentPrompt(docType);
    expect(user).toContain(purpose);
    expect(user).toContain('업로드한 지정 양식');
    expect(user).toContain('첨부 본문 속 문장');
  });

  it('무예산 계획에는 예산 항목이나 표를 강제하지 않는다', async () => {
    const { user } = await captureDocumentPrompt(
      DocType.PLAN,
      '[목적]: 독서교육\n[대상]: 전교생\n[일정]: 9월\n[방법]: 학급별 운영\n[예산]: 없음',
    );
    expect(user).toContain('예산 항목과 예산 표를 만들지 마세요');
    expect(user).not.toContain('소요예산은 표(Table)로 작성');
    expect(user).not.toContain('창의적인 부제');
  });

  it('보고서는 확인된 실적과 향후 개선 제안을 구분하고 없는 증빙을 강제하지 않는다', async () => {
    const { user } = await captureDocumentPrompt(DocType.REPORT, '[사업명]: 독서 행사\n[운영 결과]: 2회 운영');
    expect(user).toContain('실제 운영 개요 → 확인된 실적·결과 → 근거 자료 → 성과·한계 → 개선 제안');
    expect(user).toContain('실적과 결과는 확인된 과거 사실');
    expect(user).toContain('개선 제안은 향후 행동');
    expect(user).not.toContain('[사진 첨부]');
    expect(user).not.toContain('[목|세목|산출내역');
  });

  it.each([1, 5])('%i쪽 연수자료는 항목 수와 글자 수를 기계적으로 강제하지 않는다', async (pageCount) => {
    const { user } = await captureDocumentPrompt(DocType.TRAINING_MATERIAL, '[연수 내용]: 개인정보 보호', pageCount);
    expect(user).toContain(`${pageCount}쪽`);
    expect(user).toContain('학교 현장 적용');
    expect(user).not.toContain('60자 이상');
    expect(user).not.toContain('중항목을 4개 이상');
  });

  it('지정 양식이 있으면 시스템과 사용자 프롬프트에서 기본 목차를 강제하지 않는다', async () => {
    const template = 'Ⅰ. 우리 학교 현황\nⅡ. 실천 과제\nⅢ. 자체 점검';
    const { system, user } = await captureDocumentPrompt(DocType.PLAN, '[주제]: 독서교육', 2, template);
    expect(system).toContain('지정 양식의 구조를 우선');
    expect(system).not.toContain('계획서: 추진배경');
    expect(user).toContain(template);
    expect(user).toContain('기본 목차를 추가하지 마세요');
    expect(user).not.toContain('[필수 구성]');
  });

  it('직접 입력 양식과 저장한 기관 서식을 분리하고 적용 우선순위를 명시한다', async () => {
    const { user } = await captureDocumentPrompt(DocType.PLAN, '[주제]: 독서교육', 2, '현재 입력 양식', '저장 기관 양식');
    expect(user).toContain('1. 업로드한 지정 양식');
    expect(user).toContain('2. 사용자가 현재 직접 입력한 양식');
    expect(user).toContain('3. 저장한 기관 서식');
    expect(user).toContain('[사용자가 직접 입력한 양식 정보/구조]:\n현재 입력 양식');
    expect(user).toContain('[저장한 기관 서식 — 업로드 양식과 현재 직접 입력한 양식이 없을 때 적용]:\n저장 기관 양식');
  });

  it('보도자료에는 기사체와 SNS 존댓말만 적용하고 보고서용 종결을 섞지 않는다', async () => {
    const { user } = await captureDocumentPrompt(DocType.PROMOTION, '[제목]: 과학축제');
    expect(user).toContain('객관적 언론 보도용 문체');
    expect(user).toContain('친근한 존댓말');
    expect(user).not.toContain('높임말 종결은 본문에서 사용하지 마세요');
    expect(user).not.toContain('단어 또는 짧은 구로 자연스럽게 마무리');
  });

  it('동료에게 보내는 새 소통 메시지는 관계별 어조를 적용하고 학부모 전용 지시를 제외한다', async () => {
    const { user } = await captureDocumentPrompt(
      DocType.MESSAGE,
      '[유형]: 소통 메세지\n[나와의 관계]: 동료교직원\n[작성 내용]: 회의 시간 조율',
    );
    expect(user).toContain('[새 소통 메시지 작성]');
    expect(user).toContain('친근하면서도 예의 바른 어조');
    expect(user).not.toContain('학부모 알림');
    expect(user).not.toContain('문의 전화번호 포함');
  });

  it('회의록·품의서·비모집 공고의 조건부 규칙을 구분한다', async () => {
    const minutes = await captureDocumentPrompt(DocType.MEETING_MINUTES, '[논의 내용]: 안전교육 일정 검토');
    expect(minutes.user).toContain('결정 사항·담당자·기한을 구별');
    expect(minutes.user).toContain('입력에 없으면 새로 만들지');

    const expense = await captureDocumentPrompt(DocType.PUMUI, '[품의 내용]: 준비물 구입');
    expect(expense.user).toContain('품목별 줄바꿈');
    expect(expense.user).toContain('표(Table)는 사용하지');

    const notice = await captureDocumentPrompt(DocType.GONGGO, '[공고 내용]: 체육관 이용 안내');
    expect(notice.user).toContain('모집 목적일 때만');
    expect(notice.user).toContain('지원 자격·제출 서류');
  });
});
