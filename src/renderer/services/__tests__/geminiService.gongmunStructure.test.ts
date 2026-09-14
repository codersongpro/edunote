import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocType, GongmunComplexity } from '../../types';
import { generateDocument } from '../geminiService';

const aiGenerateMultipart = vi.fn();

beforeEach(() => {
  aiGenerateMultipart.mockReset();
  aiGenerateMultipart.mockResolvedValue({ text: '<html>문서</html>', model: 'gemini-test', fallbacks: [] });
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { aiGenerateMultipart },
  });
});

async function captureGongmunPrompt(complexity: GongmunComplexity): Promise<string> {
  await generateDocument(
    DocType.GONGMUN,
    '[공문 유형]: 내부결재\n[제목]: 2026. 독서교육 운영계획\n[본문 요청사항]: (미입력)',
    undefined,
    1,
    '2026',
    [],
    [],
    '',
    complexity,
  );
  const [parts, systemInstruction] = aiGenerateMultipart.mock.calls[0] as [Array<{ text?: string }>, string];
  return `${systemInstruction}\n${parts.map(part => part.text ?? '').join('\n')}`;
}

describe('겉공문 구성', () => {
  it('겉공문을 계획서 목차로 쓰지 않도록 막는다', async () => {
    for (const complexity of Object.values(GongmunComplexity)) {
      const text = await captureGongmunPrompt(complexity);
      expect(text).toContain('겉공문이며 계획서가 아닙니다');
      expect(text).toContain('추진배경, 목적, 운영방침, 세부추진계획, 소요예산, 기대효과 같은 계획서 목차를 만들지 마세요');
      aiGenerateMultipart.mockClear();
    }
  });

  it('간단 모드는 관련·본문·붙임만 쓰고 개요와 행정사항을 만들지 않는다', async () => {
    const text = await captureGongmunPrompt(GongmunComplexity.SIMPLE);
    expect(text).toContain('[작성 모드: 간단] 구성: 1.관련(입력된 경우만), 2.본문(시행문), 붙임(실제 첨부가 있을 때만).');
    expect(text).toContain('개요(가.나.다.)와 행정사항을 만들지 마세요');
    expect(text).not.toContain('3. 행정사항');
  });

  it('중간 모드는 개요를 3~4항목 요구하고 행정사항은 빼게 한다', async () => {
    const text = await captureGongmunPrompt(GongmunComplexity.MEDIUM);
    expect(text).toContain('개요(가.나.다. 3~4항목)');
    expect(text).toContain('개요는 반드시 3~4항목을 채우세요');
    expect(text).toContain('행정사항은 만들지 마세요');
    expect(text).toContain('가. 일시:');
    expect(text).toContain('라. 주요내용:');
  });

  it('상세 모드는 개요 4~6항목과 행정사항을 함께 요구한다', async () => {
    const text = await captureGongmunPrompt(GongmunComplexity.DETAILED);
    expect(text).toContain('개요(가.나.다. 4~6항목), 3.행정사항');
    expect(text).toContain('개요는 반드시 4~6항목을 채우세요');
    expect(text).toContain('행정사항은 반드시 작성하며');
    expect(text).toContain('3. 행정사항');
  });

  it('근거가 없는 관련 항목과 붙임 파일명을 지어내지 않는다', async () => {
    const text = await captureGongmunPrompt(GongmunComplexity.DETAILED);
    expect(text).toContain('관련 항목은 입력된 근거 문서가 있을 때만 쓰고');
    expect(text).toContain('문서번호나 사업명을 지어내지 마세요');
    expect(text).not.toContain('2026학년도 주요업무계획');
    expect(text).not.toContain('운영 계획서 1부');
  });
});
