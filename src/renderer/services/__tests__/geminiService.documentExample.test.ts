import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocType, GongmunComplexity } from '../../types';
import { generateDocument } from '../geminiService';
import { EXAMPLE_DOCS, buildExampleFormatInstruction } from '../../lib/documentExamples';

const aiGenerateMultipart = vi.fn();

beforeEach(() => {
  aiGenerateMultipart.mockReset();
  aiGenerateMultipart.mockResolvedValue({ text: '<html>문서</html>', model: 'gemini-test', fallbacks: [] });
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { aiGenerateMultipart },
  });
});

async function capturePrompt(docType: DocType, templateText = ''): Promise<string> {
  aiGenerateMultipart.mockClear();
  await generateDocument(
    docType,
    '[제목]: 독서교육 운영\n[주제/사업명]: 독서교육 운영',
    undefined,
    1,
    '2026',
    [],
    [],
    templateText,
    GongmunComplexity.MEDIUM,
  );
  const [parts, systemInstruction] = aiGenerateMultipart.mock.calls[0] as [Array<{ text?: string }>, string];
  return `${systemInstruction}\n${parts.map(part => part.text ?? '').join('\n')}`;
}

describe('화면 예시 문서를 형식 기준으로 사용', () => {
  it('문자를 뺀 모든 문서 종류의 프롬프트에 그 종류의 예시를 넣는다', async () => {
    const docTypes = (Object.keys(EXAMPLE_DOCS) as DocType[]).filter(type => type !== DocType.MESSAGE);
    expect(docTypes.length).toBeGreaterThan(0);
    for (const docType of docTypes) {
      const text = await capturePrompt(docType);
      expect(text).toContain('[형식 참고 예시 — 결과물이 이 예시와 닮도록 작성]');
      expect(text).toContain('[이 문서 종류의 예시 — 서식과 서술의 결을 참고]');
    }
  });

  it('문자 메시지에는 예시를 넣지 않는다', async () => {
    // 예시가 학부모 대상 LMS 표본이라, 동료·학생 요청이나 단문(SMS) 요청을 덮어쓴다.
    expect(buildExampleFormatInstruction(DocType.MESSAGE)).toBe('');
    const text = await capturePrompt(DocType.MESSAGE);
    expect(text).not.toContain('[형식 참고 예시 — 결과물이 이 예시와 닮도록 작성]');
  });

  it('화면 예시와 같은 제목·표·쪽나눔 서식을 규격으로 전달한다', async () => {
    const block = buildExampleFormatInstruction(DocType.PLAN);
    expect(block).toContain('font-size:22pt; font-weight:bold');
    expect(block).toContain('font-size:15pt; font-weight:bold');
    expect(block).toContain('background-color:#f3f4f6; font-weight:bold;');
    expect(block).toContain('page-break-after:always');
    // 생성 결과는 <body> 안쪽만 내보내야 하므로 껍데기를 보내지 않는다.
    expect(block).not.toContain('<!DOCTYPE html>');
    expect(block).not.toContain('</body>');
    expect(await capturePrompt(DocType.PLAN)).toContain(block);
  });

  it('예시 안의 지어내면 안 되는 값은 가리고 내보낸다', async () => {
    // 예시 HTML을 그대로 넣으면 공고번호·문서번호·날짜·금액·붙임 파일명·사진 자리표시자까지
    // 베껴 문서 종류별 사실성 규칙을 깨뜨린다. 서식과 서술은 남기고 값만 가린다.
    for (const docType of Object.keys(EXAMPLE_DOCS) as DocType[]) {
      const block = buildExampleFormatInstruction(docType);
      for (const fabricated of [
        '제2026-001호',        // 공고 번호
        '창의특수교육과-1234', // 공문 문서번호
        '2026. 4. 18.',        // 날짜
        '500,000',             // 금액
        '운영 계획서 1부',     // 붙임 파일명
        '[사진 첨부]',         // 자료 없는 사진란
        '미래고등학교',        // 기관명
        '해솔초등학교',
      ]) {
        expect(block).not.toContain(fabricated);
      }
    }
  });

  it('가린 자리를 ○ 그대로 출력하지 않도록 못 박는다', async () => {
    const text = await capturePrompt(DocType.PLAN);
    expect(text).toContain('○를 그대로 출력하지 마세요');
  });

  it('서식과 서술의 결을 참고하도록 예시 본문을 함께 보낸다', () => {
    const block = buildExampleFormatInstruction(DocType.PLAN);
    // 표 서식과 항목 위계가 살아 있어야 형식을 따라 할 수 있다.
    expect(block).toContain('background-color:#f3f4f6');
    expect(block).toContain('page-break-after');
    expect(block).toContain('추진배경');
    // 생성 결과는 <body> 안쪽만 내보내야 하므로 껍데기는 보내지 않는다.
    expect(block).not.toContain('<!DOCTYPE html>');
    expect(block).not.toContain('</body>');
  });

  it('서식을 맞추려고 없는 섹션과 표를 만들지 않도록 못 박는다', async () => {
    const text = await capturePrompt(DocType.PLAN);
    expect(text).toContain('사용자 입력에 근거가 없는 섹션은 예시에 있더라도 만들지 마세요');
    expect(text).toContain('넣을 내용이 없는 표·사진란·자리표시자는 아예 그리지 않습니다');
    expect(text).toContain('예시는 형식 기준이지 내용 출처가 아닙니다');
  });

  it('지정 양식을 올린 경우에는 예시를 넣지 않는다', async () => {
    const text = await capturePrompt(DocType.PLAN, '기관 지정 계획서 양식\n1. 사업명\n2. 기간');
    expect(text).toContain('[양식 (템플릿) 지침]');
    expect(text).not.toContain('[형식 참고 예시 — 결과물이 이 예시와 닮도록 작성]');
    // 예시를 넣지 않았으면 우선순위 목록에도 예시 줄을 두지 않는다.
    expect(text).not.toContain('5. 아래 [형식 참고 예시]');
    expect(text).toContain('5. 해당 문서 종류의 기본 형식');
  });

  it('형식 우선순위에서 지정 양식·직접 입력·요청문 뒤에 놓는다', async () => {
    const text = await capturePrompt(DocType.PLAN);
    const priority = text.indexOf('[문서 형식 우선순위');
    expect(priority).toBeGreaterThanOrEqual(0);
    expect(text).toContain('5. 아래 [형식 참고 예시]로 제공된 해당 문서 종류의 표준 예시');
    expect(text.indexOf('1. 업로드한 지정 양식')).toBeLessThan(text.indexOf('5. 아래 [형식 참고 예시]'));
  });

  it('예시가 없는 문서 종류에는 빈 문자열을 돌려준다', () => {
    const withoutExample = (Object.values(DocType) as DocType[]).filter(type => !EXAMPLE_DOCS[type]);
    for (const docType of withoutExample) {
      expect(buildExampleFormatInstruction(docType)).toBe('');
    }
  });
});
