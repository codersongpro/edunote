import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocType, GongmunComplexity, type GonggoInputs } from '../../types';
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

async function captureDocumentPrompt(
  docType: DocType,
  promptContext: string,
  gonggoInputs?: GonggoInputs,
  gongmunComplexity: GongmunComplexity = GongmunComplexity.MEDIUM,
): Promise<string> {
  await generateDocument(
    docType,
    promptContext,
    undefined,
    1,
    '2026',
    [],
    [],
    '',
    gongmunComplexity,
    gonggoInputs,
  );
  const [parts, systemInstruction] = aiGenerateMultipart.mock.calls[0] as [Array<{ text?: string }>, string];
  return `${systemInstruction}\n${parts.map(part => part.text ?? '').join('\n')}`;
}

describe('문서 생성 미입력 사실 처리', () => {
  it('공고 번호를 임의 생성하지 않고 프로필 기관과 전용 입력을 함께 전달한다', async () => {
    const text = await captureDocumentPrompt(
      DocType.GONGGO,
      '[참고 기본정보]\n학년도: 2026학년도\n소속기관: 새봄학교',
      { title: '강사 모집', number: '', content: '방과후 강사 모집', deadline: '', contact: '', extraInfo: '' },
    );
    expect(text).toContain('소속기관: 새봄학교');
    expect(text).toContain('공고 제목: 강사 모집');
    expect(text).not.toContain('제2026-001호');
    // 공고 번호는 기관이 부여하는 값이라 추정하지 않고 해당 줄을 생략한다.
    expect(text).toContain('공고 번호: (미입력 — 기관이 부여하는 값이므로 추정하지 말고 해당 줄을 생략)');
    expect(text).toContain('공고번호와 공고일은 기관이 부여하는 값이므로 입력에 없으면 임의로 만들지 말고 해당 줄을 생략');
    expect(text).toContain('오늘 날짜를 공고일로 확정하지');
  });

  it('공고 제목만 입력해도 내용·접수기간·문의처를 주제에 맞게 채우게 한다', async () => {
    const text = await captureDocumentPrompt(
      DocType.GONGGO,
      '[참고 기본정보]\n소속기관: 새봄학교',
      { title: '방과후 독서교실 운영 안내', number: '', content: '', deadline: '', contact: '', extraInfo: '' },
    );
    // 학교가 정하는 값은 비워 두지 않고 채운다.
    expect(text).toContain('공고 내용: (미입력 — 공고 제목과 주제에 맞게 직접 작성)');
    expect(text).toContain('접수 기간/마감: (미입력 — 공고 제목과 주제에 맞게 직접 작성)');
    expect(text).toContain('문의처: (미입력 — 공고 제목과 주제에 맞게 직접 작성)');
    // 지침 본문에는 "[확인 필요: ...]를 쓰지 말라"는 금지 문구가 남으므로 항목별로 확인한다.
    expect(text).not.toContain('[확인 필요: 공고 내용]');
    expect(text).not.toContain('[확인 필요: 접수 기간/마감]');
    expect(text).not.toContain('[확인 필요: 문의처]');
  });

  it('명시한 공고 번호와 공고일은 입력 블록에 그대로 유지한다', async () => {
    const text = await captureDocumentPrompt(
      DocType.GONGGO,
      '[참고 기본정보]\n소속기관: 새봄학교',
      { title: '강사 모집', number: '제2026-17호', content: '강사 모집', deadline: '9월 20일', contact: '교무실', extraInfo: '공고일: 2026. 9. 7.' },
    );
    expect(text).toContain('공고 번호: 제2026-17호');
    expect(text).toContain('공고일: 2026. 9. 7.');
  });

  it('인용 내용이 없는 보도자료는 인터뷰 대상자의 발언을 만들지 않는다', async () => {
    const text = await captureDocumentPrompt(DocType.PROMOTION, '[제목]: 과학축제\n[인터뷰 대상자]: 교장');
    expect(text).toContain('실제 인용 내용이 입력이나 첨부에 있을 때만 직접 인용');
    expect(text).not.toContain('관계자 인터뷰 인용구 형식');
  });

  it('만족도 자료가 없는 보고서에 조사 실시나 수치를 만들도록 요구하지 않는다', async () => {
    const text = await captureDocumentPrompt(DocType.REPORT, '[사업명]: 독서 행사\n[운영 결과]: 2회 운영');
    expect(text).toContain('자료 미제공과 실제 미실시를 구별');
    expect(text).not.toContain('별도 조사 실시 예정');
    expect(text).not.toContain('참여자 만족도 설문 결과 요약 표');
  });

  it('계획액과 집행액을 서로 바꾸거나 계산하지 않고 입력 블록에 보존한다', async () => {
    const text = await captureDocumentPrompt(DocType.REPORT, '[계획액]: 100000원\n[집행액]: 82000원');
    expect(text).toContain('[계획액]: 100000원');
    expect(text).toContain('[집행액]: 82000원');
    expect(text).toContain('입력한 수치와 사실은 그대로 사용');
  });

  it('서술 항목은 주제에 맞게 직접 작성하도록 요구한다', async () => {
    const text = await captureDocumentPrompt(
      DocType.GONGMUN,
      '[공문 유형]: 내부결재\n[제목]: 2026. 독서교육 운영계획\n[본문 요청사항]: (미입력)',
    );
    expect(text).toContain('[서술 항목]');
    expect(text).toContain('교사가 곧바로 손볼 수 있는 완성된 초안이어야 합니다');
    expect(text).toContain('"[확인 필요: ...]", "○○○", "(추후 결정)" 같은 자리표시자로 남기지 말고');
    // 예시가 서술 항목을 자리표시자로 보여주면 모델이 그대로 따라 쓴다.
    expect(text).not.toContain('[확인 필요: 주요내용]');
    expect(text).not.toContain('[확인 필요: 대상]');
  });

  it('학교가 정하는 값은 채우되 외부 식별자는 지어내지 않게 한다', async () => {
    const text = await captureDocumentPrompt(DocType.PLAN, '[주제/사업명]: 독서교육\n[예산]: (미입력)');
    expect(text).toContain('[학교가 정하는 값 — 주제에 맞게 채움]');
    expect(text).toContain('없으면 학년도와 주제에 어울리는 현실적인 값으로 채우세요');
    expect(text).toContain('[외부에 실재하는 식별자 — 지어내기 금지]');
    expect(text).toContain('입력이나 첨부에 없으면 해당 항목을 통째로 생략하세요');
    // 채운 값이 학사 일정과 어긋나지 않도록 제한한다.
    expect(text).toContain('학년도·학사 일정과 어긋나는 날짜');
  });

  it('첨부가 없는 겉공문에 관련 문서나 붙임 파일명을 만들지 않는다', async () => {
    const text = await captureDocumentPrompt(DocType.GONGMUN, '[제목]: 안전교육 안내');
    expect(text).toContain('관련 문서와 붙임은 실제 입력이나 첨부가 있을 때만');
    expect(text).not.toContain('운영 계획서 1부');
    expect(text).not.toContain('2026학년도 주요업무계획');
  });
});
