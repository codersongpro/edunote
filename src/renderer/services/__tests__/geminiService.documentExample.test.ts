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
  it('예시가 있는 모든 문서 종류의 프롬프트에 형식 참고 예시를 넣는다', async () => {
    const docTypes = Object.keys(EXAMPLE_DOCS) as DocType[];
    expect(docTypes.length).toBeGreaterThan(0);
    for (const docType of docTypes) {
      const text = await capturePrompt(docType);
      expect(text).toContain('[형식 참고 예시 — 결과물이 이 예시와 닮도록 작성]');
    }
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

  it('예시 문서의 내용은 프롬프트에 싣지 않는다', async () => {
    // 예시 HTML을 통째로 넣으면 공고번호·붙임 파일명·사진 자리표시자까지 베껴
    // 문서 종류별 사실성 규칙을 깨뜨린다. 서식만 옮기고 내용은 빼야 한다.
    for (const docType of Object.keys(EXAMPLE_DOCS) as DocType[]) {
      const block = buildExampleFormatInstruction(docType);
      for (const fabricated of ['제2026-001호', '운영 계획서 1부', '[사진 첨부]', '학부모 알림', '충북GEG']) {
        expect(block).not.toContain(fabricated);
      }
    }
  });

  it('서식을 맞추려고 없는 섹션과 표를 만들지 않도록 못 박는다', async () => {
    const text = await capturePrompt(DocType.PLAN);
    expect(text).toContain('입력에 없는 섹션·표·자리표시자를 만들지 마세요');
    expect(text).toContain('넣을 내용이 없는 표는 아예 그리지 않습니다');
    expect(text).toContain('어떤 항목을 넣을지는 앞의 작성 지침과 사용자 입력이 정합니다');
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
