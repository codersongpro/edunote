import { describe, expect, it } from 'vitest';
import { API_KEY_UPDATED_EVENT, GEMINI_API_CLOUD_FALLBACK_STEPS, GEMINI_API_GUIDE_STEPS } from '../apiKeyGuide';

describe('GEMINI_API_GUIDE_STEPS', () => {
  it('guides users through the first option: create a project and issue an API key', () => {
    const guide = GEMINI_API_GUIDE_STEPS.join('\n');

    expect(guide).toContain('첫 번째 방법');
    expect(guide).toContain('aistudio.google.com');
    expect(guide).toContain('API 키');
    expect(guide).toContain('프로젝트 만들기');
    expect(guide).toContain('edunote');
    expect(guide).toContain('프로젝트 가져오기');
    expect(guide).toContain('Select a Cloud Project');
    expect(guide).toContain('키 만들기');
    expect(guide).toContain('붙여넣고 키 테스트 후 저장');
  });

  it('keeps the direct Google AI Studio flow separate from the Cloud fallback', () => {
    expect(GEMINI_API_GUIDE_STEPS.join('\n')).not.toContain('console.cloud.google.com');
  });
});

describe('GEMINI_API_CLOUD_FALLBACK_STEPS', () => {
  it('documents Google Cloud as the second API key issuance option', () => {
    const guide = GEMINI_API_CLOUD_FALLBACK_STEPS.join('\n');

    expect(guide).toContain('두 번째 대안');
    expect(guide).not.toContain('세 번째 대안');
    expect(guide).toContain('console.cloud.google.com');
    expect(guide).toContain('Google Cloud');
    expect(guide).toContain('Generative Language API');
    expect(guide).toContain('API 키');
  });
});

describe('API_KEY_UPDATED_EVENT', () => {
  it('uses the shared event name for API key refreshes', () => {
    expect(API_KEY_UPDATED_EVENT).toBe('edunote:api-key-updated');
  });
});
