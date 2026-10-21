import { beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshOfficialDocument, reviewDocument, reviewStudentRecord } from '../geminiService';
import { runDocRules } from '../../lib/docRules';
import { runRecordRules } from '../../lib/recordRules';

const aiGenerateMultipart = vi.fn();

beforeEach(() => {
  aiGenerateMultipart.mockReset();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { aiGenerateMultipart },
  });
});

const promptOf = (call = 0) => (aiGenerateMultipart.mock.calls[call][0] as Array<{ text?: string }>)[0].text ?? '';
const optionsOf = (call = 0) => aiGenerateMultipart.mock.calls[call][2];

describe('reviewDocument', () => {
  it('문서·규칙 결과 속 개인정보를 가려 보내고, 원문과 맞는 제안만 돌려준다', async () => {
    aiGenerateMultipart.mockResolvedValue({
      text: JSON.stringify({
        suggestions: [
          { idx: 1, before: '참여률', after: '참여율', severity: 'error', category: '맞춤법' },
          { idx: 1, before: '없는 글자', after: 'x' },
        ],
        checkItems: ['붙임 확인'],
      }),
      model: 'gemini-test',
    });
    const nodes = ['문의 010-1234-5678', '학생 참여률 제고'];
    const result = await reviewDocument({ nodes, files: [], docKind: '공문', ruleFindings: runDocRules(nodes, { docKind: '공문' }) });

    expect(promptOf()).not.toContain('010-1234-5678');
    expect(promptOf()).toContain('010-****-5678');
    expect(optionsOf()).toMatchObject({ responseJson: true });
    expect(result.suggestions.map(s => s.after)).toEqual(['참여율']);
    expect(result).toMatchObject({ checkItems: ['붙임 확인'], model: 'gemini-test', transcribed: false });
  });

  it('웹 검색을 켜면 JSON 응답 모드 대신 검색 도구를 쓰고 산문 속 JSON을 꺼낸다', async () => {
    aiGenerateMultipart.mockResolvedValue({ text: '검토했습니다.\n```json\n{"suggestions":[],"checkItems":[]}\n```', model: 'm', grounding: { sources: [{ title: '법령', uri: 'https://law.go.kr' }], searchQueries: [], searchSuggestionHtml: '' } });
    const result = await reviewDocument({ nodes: ['본문'], files: [], docKind: '계획서', ruleFindings: [], useSearchGrounding: true });
    expect(optionsOf()).toEqual({ temperature: 0.2, useSearchGrounding: true });
    expect(result.grounding?.sources[0].uri).toBe('https://law.go.kr');
  });

  it('이미지·PDF만 있으면 AI가 옮겨 적은 줄을 노드로 쓰고, 읽지 못하면 오류를 낸다', async () => {
    const file = { file: new File(['x'], 'a.png'), base64: 'data:image/png;base64,AAAA', mimeType: 'image/png' };
    aiGenerateMultipart.mockResolvedValue({ text: JSON.stringify({ transcript: ['2026. 3. 4.(화) 협의'], suggestions: [] }), model: 'm' });
    const result = await reviewDocument({ nodes: [], files: [file], docKind: '공문', ruleFindings: [] });
    expect(result).toMatchObject({ nodes: ['2026. 3. 4.(화) 협의'], transcribed: true });
    expect((aiGenerateMultipart.mock.calls[0][0] as unknown[])[1]).toEqual({ inlineData: { data: 'AAAA', mimeType: 'image/png' } });

    aiGenerateMultipart.mockResolvedValue({ text: '{"transcript":[],"suggestions":[]}', model: 'm' });
    await expect(reviewDocument({ nodes: [], files: [file], docKind: '공문', ruleFindings: [] })).rejects.toThrow('글자를 읽지 못했습니다');
  });
});

describe('refreshOfficialDocument', () => {
  it('학년도와 변경사항을 전달하고 변경사항 속 개인정보도 가린다', async () => {
    aiGenerateMultipart.mockResolvedValue({ text: '{"suggestions":[]}', model: 'm' });
    await refreshOfficialDocument({ nodes: ['2025학년도 계획'], files: [], baseYear: 2025, targetYear: 2026, changeNotes: '담당 010-9876-5432', ruleFindings: [] });
    expect(promptOf()).toContain('2025학년도');
    expect(promptOf()).toContain('2026학년도 문서로 현행화');
    expect(promptOf()).not.toContain('010-9876-5432');
  });
});

describe('reviewStudentRecord', () => {
  it('개인정보 보호 모드면 학생·명단 이름을 가려 보내고 응답에서 되돌린다', async () => {
    aiGenerateMultipart.mockImplementation(async (parts: Array<{ text?: string }>) => {
      const token = parts[0].text!.match(/\[학생 이름: (학생\d+)\]/)![1];
      return { text: JSON.stringify({ suggestions: [{ idx: 0, before: `${token}은`, after: '', severity: 'warning', category: '주어' }] }), model: 'm' };
    });
    const text = '이서연은 김민수와 협력함.';
    const result = await reviewStudentRecord({
      text, recordKind: 'subject', studentName: '이서연', sourceNotes: '모둠 활동 성실', privacyModeEnabled: true, rosterNames: ['김민수'],
      ruleFindings: runRecordRules([text], { studentName: '이서연', rosterNames: ['김민수'] }),
    });
    expect(promptOf()).not.toContain('이서연');
    expect(promptOf()).not.toContain('김민수');
    expect(result.suggestions.map(s => s.before)).toEqual(['이서연은']);
  });
});
