import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateLessonWorksheet, type LessonParams } from '../geminiService';

const aiGenerate = vi.fn();
const params: LessonParams = {
  grade: '초등학교 6학년',
  subject: '과학',
  unit: '생물과 환경',
  topic: '생태계 구성 요소',
};

beforeEach(() => {
  aiGenerate.mockReset();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { aiGenerate },
  });
});

const generateFrom = async (
  html: string,
  type: 'activity' | 'assessment' = 'activity',
  count = 2,
  includeScore = false,
  insertImage = false,
  customParams = params,
) => {
  aiGenerate.mockResolvedValueOnce({ text: html, model: 'gemini-test', fallbacks: [] });
  const result = await generateLessonWorksheet(customParams, type, count, includeScore, insertImage);
  return { result, prompt: String(aiGenerate.mock.calls.at(-1)?.[0] ?? '') };
};

const studentHtml = '<!DOCTYPE html><html><body><h1>생태계 활동지</h1><p>관찰한 내용을 쓰세요.</p><div class="answer-lines"></div></body></html>';

describe('워크시트와 평가지 목적 분리', () => {
  it('활동형은 관찰·조작·기록·설명 절차와 학습 도움을 요구한다', async () => {
    const { prompt } = await generateFrom(studentHtml, 'activity', 2, false);

    expect(prompt).toContain('[활동형 워크시트 목적]');
    expect(prompt).toContain('관찰·조작·기록·설명');
    expect(prompt).toContain('필요한 도움과 단계');
    expect(prompt).toContain('바로 수행할 활동의 답을 알려 주는 힌트');
    expect(prompt).toContain('- 점수란 포함: 아니오');
  });

  it('평가형은 평가 요소·문항 조건·배점 규칙을 별도로 요구한다', async () => {
    const { prompt } = await generateFrom(studentHtml, 'assessment', 5, true);

    expect(prompt).toContain('[학생용 평가지 목적]');
    expect(prompt).toContain('확인할 평가 요소');
    expect(prompt).toContain('정답이 하나로 결정되는 문항');
    expect(prompt).toContain('정답이 결정되지 않는 질문');
    expect(prompt).toContain('문항별 배점의 합계');
    expect(prompt).toContain('- 점수란 포함: 예');
    expect(prompt).not.toContain('[활동형 워크시트 목적]');
  });
});

describe('학생용 출력과 읽기·쓰기 공간', () => {
  it.each([
    ['초등학교 1학년', 2, false],
    ['초등학교 6학년', 5, false],
    ['초등학교 6학년', 10, true],
  ])('%s 활동 %i개의 기본 글자 크기와 답안 공간을 문항 수 때문에 줄이지 않는다', async (grade, count, insertImage) => {
    const { prompt } = await generateFrom(studentHtml, 'activity', count, false, insertImage, { ...params, grade });

    expect(prompt).toContain("body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; font-size: 12pt;");
    expect(prompt).toContain('예상 응답의 길이와 활동 방식에 맞춰');
    expect(prompt).toContain('글자 크기보다 작게 줄이지 마세요');
    expect(prompt).toContain('A4 한 장은 목표');
    expect(prompt).not.toContain('반드시 A4 용지 1장');
    expect(prompt).not.toMatch(/답변 공간은 줄 1~3개|최소한의 공간|컴팩트/);
    if (insertImage) expect(prompt).toContain('[WORKSHEET_IMAGE]');
  });

  it('학생용 본문에 정답·해설·채점 기준을 보이거나 숨겨 넣지 않게 지시한다', async () => {
    const { prompt } = await generateFrom(studentHtml, 'assessment', 3, true);

    expect(prompt).toContain('학생에게 배포하는 학생용 결과');
    expect(prompt).toContain('교사용 정답·해설·채점 기준');
    expect(prompt).toContain('CSS로 숨기거나 HTML 주석에 넣는 방식도 금지');
  });

  it.each([
    '<html><body><section>정답: ③</section></body></html>',
    '<html><body><div style="display:none">정답: ③</div></body></html>',
    '<html><body><!-- 해설: 광합성 --><p>문항</p></body></html>',
  ])('정답 자료가 포함된 학생용 HTML을 거부한다', async (html) => {
    await expect(generateFrom(html, 'assessment', 1, true)).rejects.toThrow('학생용');
  });

  it('답안 작성선만 있는 학생용 HTML은 그대로 반환한다', async () => {
    await expect(generateFrom(studentHtml)).resolves.toMatchObject({
      result: { text: studentHtml, model: 'gemini-test' },
    });
  });
});
