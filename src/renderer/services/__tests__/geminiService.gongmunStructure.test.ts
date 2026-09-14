import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocType, GongmunComplexity, GongmunType } from '../../types';
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

async function captureGongmunPrompt(
  complexity: GongmunComplexity,
  gongmunType: GongmunType = GongmunType.EXTERNAL,
): Promise<string> {
  aiGenerateMultipart.mockClear();
  await generateDocument(
    DocType.GONGMUN,
    '[공문 유형]: 수신자 참조(발송 공문)\n[제목]: 2026. 충북교육영상제 운영 계획\n[본문 요청사항]: (미입력)',
    gongmunType,
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
    }
  });

  it('간단 모드는 관련·본문·붙임만 쓰고 개요와 행정사항을 만들지 않는다', async () => {
    const text = await captureGongmunPrompt(GongmunComplexity.SIMPLE);
    expect(text).toContain('[작성 모드: 간단] 구성: 1.관련(입력된 경우만), 2.본문(시행문), 붙임(실제 첨부가 있을 때만).');
    expect(text).toContain('개요(가.나.다.)와 행정사항을 만들지 마세요');
    expect(text).not.toContain('바. 행정사항');
  });

  it('중간 모드는 개요를 3~5항목 요구하고 행정사항은 빼게 한다', async () => {
    const text = await captureGongmunPrompt(GongmunComplexity.MEDIUM);
    expect(text).toContain('개요(가.나.다. 3~5항목)');
    expect(text).toContain('개요는 본문 2.의 하위 항목으로 들여쓰고, 반드시 3~5항목을 채우세요');
    expect(text).toContain('행정사항은 만들지 마세요');
    expect(text).toContain('가. 행 사 명:');
  });

  it('상세 모드는 행정사항을 별도 대항목이 아니라 개요의 마지막 항목으로 넣게 한다', async () => {
    const text = await captureGongmunPrompt(GongmunComplexity.DETAILED);
    expect(text).toContain("개요(가.나.다. 5~7항목, 마지막 항목을 '행정사항'으로)");
    expect(text).toContain('행정사항은 별도 대항목(3.)으로 빼지 말고 개요의 마지막 항목');
    expect(text).toContain('바. 행정사항:');
    // 1.관련 / 2.본문 외에 3.으로 시작하는 대항목을 예시에 두지 않는다.
    expect(text).not.toContain('<br><br>3. 행정사항');
  });

  it('실제 공문 표기 규칙(말머리·낫표·문서번호·날짜·항목 정렬)을 지시한다', async () => {
    const text = await captureGongmunPrompt(GongmunComplexity.MEDIUM);
    expect(text).toContain('[안내], [알림], [신청], [제출], [협조], [참석]');
    expect(text).toContain('법령·조례·규칙·지침·제도 이름은 「 」로 감싸세요');
    expect(text).toContain('"부서명-문서번호(YYYY. M. D.)" 형식');
    expect(text).toContain('2026. 11. 6.(금) ~ 11. 7.(토)');
    expect(text).toContain('콜론(:) 위치가 세로로 맞도록');
    expect(text).toContain("'※'로 적으세요");
    expect(text).toContain('근거가 1건이면 "1. 관련: ○○" 한 줄로, 2건 이상이면');
  });

  it('발송 공문과 내부결재의 제목 말머리와 시행문 종결을 구분한다', async () => {
    const external = await captureGongmunPrompt(GongmunComplexity.MEDIUM, GongmunType.EXTERNAL);
    expect(external).toContain('수신자 참조');
    expect(external).toContain('제목 앞에 수신처가 할 일을 나타내는 말머리를 대괄호로 붙이세요');
    expect(external).toContain('"~하오니 ~할 수 있도록 안내하여(협조하여) 주시기 바랍니다."');

    const internal = await captureGongmunPrompt(GongmunComplexity.MEDIUM, GongmunType.INTERNAL);
    expect(internal).toContain('(내부결재)');
    expect(internal).toContain('내부결재이므로 제목에 말머리를 붙이지 마세요');
    expect(internal).toContain('"~하고자 합니다."');
  });

  it('붙임이 1건일 때와 2건 이상일 때의 표기를 구분해 지시한다', async () => {
    const text = await captureGongmunPrompt(GongmunComplexity.MEDIUM);
    expect(text).toContain('붙임이 1건이면 번호 없이 "붙임  ○○ 1부.  끝."');
    expect(text).toContain('2건 이상이면 "붙임  1. ○○ 1부." 아래로 번호를 매기고');
  });

  it('근거가 없는 관련 항목과 붙임 파일명을 지어내지 않는다', async () => {
    const text = await captureGongmunPrompt(GongmunComplexity.DETAILED);
    expect(text).toContain('입력된 근거 문서가 있을 때만 쓰고');
    expect(text).toContain('문서번호나 사업명을 지어내지 마세요');
    expect(text).not.toContain('2026학년도 주요업무계획');
    expect(text).not.toContain('운영 계획서 1부');
  });
});
