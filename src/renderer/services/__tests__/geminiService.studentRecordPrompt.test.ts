import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SchoolLevel } from '../../types';
import {
  askRecordChatbot,
  generateCreativeActivityReport,
  generateOpinion,
  generateSportsClubReport,
  generateSubjectReport,
} from '../geminiService';

const aiGenerate = vi.fn();

beforeEach(() => {
  aiGenerate.mockReset();
  aiGenerate.mockResolvedValue({ text: '생성 결과', model: 'gemini-test', fallbacks: [] });
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { aiGenerate },
  });
});

const combinedCallText = (callIndex: number): string => {
  const [prompt, systemInstruction] = aiGenerate.mock.calls[callIndex];
  return `${systemInstruction}\n${prompt}`;
};

describe('학생기록 프롬프트 사실성', () => {
  it('교과 세특은 확인된 분수 비교 행동만 쓰고 점수·5단계·진로 확장을 강제하지 않는다', async () => {
    await generateSubjectReport({
      schoolLevel: SchoolLevel.MIDDLE,
      studentName: '김민수',
      subject: '수학',
      tasks: [{ id: 'task-1', task: '분수 크기 비교', level: '중' }],
      additionalContext: '교사가 제시한 예를 참고해 분모를 통일하여 비교함.',
      lengthOption: '200',
      lengthUnit: '자',
      privacyModeEnabled: true,
      studentMemos: ['분모를 통일한 뒤 크기를 비교함'],
    });

    const text = combinedCallText(0);
    expect(text).toContain('확인된 관찰과 활동 내용의 사실만 사용');
    expect(text).toContain('성취수준·태그만으로 사건, 동기, 사고 과정, 성장, 역할을 만들지');
    expect(text).toContain('예시는 문체만 참고하고 예시의 사건을 옮기지');
    expect(text).not.toMatch(/0~1점|4~5점|Action→Process|5단계|진로·전공역량/);
  });

  it('최소 95% 분량을 강제하지 않고 사실이 부족하면 목표보다 짧게 쓸 수 있으며 이름 가림을 유지한다', async () => {
    await generateOpinion({
      schoolLevel: SchoolLevel.ELEMENTARY,
      studentName: '김민수',
      positiveTags: ['협력적'],
      negativeTags: [],
      additionalContext: '준비물을 모아 정리함.',
      lengthOption: '200',
      lengthUnit: '자',
      privacyModeEnabled: true,
    });

    const [prompt] = aiGenerate.mock.calls[0] as [string, string];
    expect(prompt).toContain('공백 포함 200자 내외를 목표');
    expect(prompt).toContain('입력 사실이 부족하면 분량보다 사실 충실성을 우선');
    expect(prompt).not.toContain('최소 190자');
    expect(prompt).not.toContain('김민수');
    expect(prompt).toContain('학생1');
  });

  it('행발·교과·스포츠·창체와 챗봇 문구 예시에 같은 사실성 원칙을 적용한다', async () => {
    await generateOpinion({
      schoolLevel: SchoolLevel.HIGH,
      studentName: '가학생',
      positiveTags: ['성실함'],
      negativeTags: [],
      additionalContext: '',
      lengthOption: '100',
      lengthUnit: 'byte',
    });
    await generateSubjectReport({
      schoolLevel: SchoolLevel.HIGH,
      studentName: '나학생',
      subject: '과학',
      tasks: [{ id: 'task-2', task: '관찰 활동', level: '하' }],
      additionalContext: '',
      lengthOption: '100',
      lengthUnit: 'byte',
    });
    await generateSportsClubReport({
      schoolLevel: SchoolLevel.HIGH,
      studentName: '다학생',
      sportName: '배드민턴',
      clubName: '배드민턴반',
      additionalContext: '셔틀콕을 주워 정리함.',
      lengthOption: '100',
      lengthUnit: 'byte',
    });
    await generateCreativeActivityReport({
      schoolLevel: SchoolLevel.HIGH,
      studentName: '라학생',
      activityName: '학급회의',
      activityType: '자율활동',
      annualPlan: '매월 학급회의 운영',
      keywords: [],
      additionalContext: '회의 자료를 배부함.',
      lengthOption: '100',
      lengthUnit: 'byte',
    });
    await askRecordChatbot(SchoolLevel.HIGH, [], '관찰 메모를 기록 문구로 다듬어 줘');

    for (let index = 0; index < 5; index += 1) {
      const text = combinedCallText(index);
      expect(text).toContain('입력에 없는 사실을 추가했는지 확인해 제거');
      expect(text).not.toMatch(/낮은 평가|높은 평가|감점 표현|가점 표현|4~5점/);
    }
    expect(combinedCallText(3)).toContain('공통 계획을 개인이 실제로 수행했다는 근거로 바꾸지');
  });
});
