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
    GongmunComplexity.MEDIUM,
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
    expect(text).toContain('[확인 필요: 공고 번호]');
    expect(text).toContain('오늘 날짜를 공고일로 확정하지');
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

  it('첨부가 없는 겉공문에 관련 문서나 붙임 파일명을 만들지 않는다', async () => {
    const text = await captureDocumentPrompt(DocType.GONGMUN, '[제목]: 안전교육 안내');
    expect(text).toContain('관련 문서와 붙임은 실제 입력이나 첨부가 있을 때만');
    expect(text).not.toContain('운영 계획서 1부');
    expect(text).not.toContain('2026학년도 주요업무계획');
  });
});
