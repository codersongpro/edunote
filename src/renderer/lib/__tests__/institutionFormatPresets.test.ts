import { describe, expect, it } from 'vitest';
import { DocType } from '../../types';
import {
  BULLET_STYLE_OPTIONS,
  ENDING_STYLE_OPTIONS,
  INSTITUTION_FORMAT_PRESETS,
  draftFromPreset,
  presetById,
  presetsForDocType,
} from '../institutionFormatPresets';
import { buildInstitutionFormatInstruction, normalizeInstitutionFormat } from '../workflowFeatures';

describe('기관 서식 기본 제공 목록', () => {
  it('모든 기본 서식이 고르자마자 쓸 수 있는 값을 갖춘다', () => {
    expect(INSTITUTION_FORMAT_PRESETS.length).toBeGreaterThan(0);
    INSTITUTION_FORMAT_PRESETS.forEach(preset => {
      expect(preset.id).toMatch(/^[a-z0-9-]+$/);
      expect(preset.name.trim()).not.toBe('');
      expect(preset.docTypes.length).toBeGreaterThan(0);
      expect(preset.outline.trim()).not.toBe('');
      expect(preset.bulletStyle.trim()).not.toBe('');
      expect(preset.endingStyle.trim()).not.toBe('');
      expect(preset.fontSize).toBeGreaterThanOrEqual(8);
      expect(preset.fontSize).toBeLessThanOrEqual(30);
      // 고른 즉시 생성 프롬프트에 들어갈 서식 문장이 만들어져야 한다.
      expect(buildInstitutionFormatInstruction(draftFromPreset(preset))).toContain('목차:');
    });
  });

  it('서식 id가 중복되지 않는다', () => {
    const ids = INSTITUTION_FORMAT_PRESETS.map(preset => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('문서 종류에 맞는 서식을 추천 목록으로 먼저 준다', () => {
    const { recommended, others } = presetsForDocType(DocType.GONGMUN);

    expect(recommended.length).toBeGreaterThan(0);
    expect(recommended.every(preset => preset.docTypes.includes(DocType.GONGMUN))).toBe(true);
    expect(others.some(preset => preset.docTypes.includes(DocType.GONGMUN))).toBe(false);
    expect(recommended.length + others.length).toBe(INSTITUTION_FORMAT_PRESETS.length);
  });

  it('문서 종류마다 추천 서식이 하나 이상 있다', () => {
    [
      DocType.GONGMUN, DocType.PLAN, DocType.TRAINING_MATERIAL, DocType.REPORT, DocType.PUMUI,
      DocType.MEETING_MINUTES, DocType.PROMOTION, DocType.NEWSLETTER, DocType.MESSAGE, DocType.GONGGO,
    ].forEach(docType => {
      expect(presetsForDocType(docType).recommended.length).toBeGreaterThan(0);
    });
  });

  it('고른 서식을 저장할 때 저장 규격을 그대로 통과한다', () => {
    const preset = INSTITUTION_FORMAT_PRESETS[0];
    const saved = normalizeInstitutionFormat({ id: 'f1', docType: DocType.PLAN, ...draftFromPreset(preset) });

    expect(saved.name).toBe(preset.name);
    expect(saved.outline).toBe(preset.outline);
    expect(saved.fontSize).toBe(preset.fontSize);
  });

  it('id로 서식을 찾고 없는 id는 undefined를 돌려준다', () => {
    expect(presetById(INSTITUTION_FORMAT_PRESETS[0].id)?.name).toBe(INSTITUTION_FORMAT_PRESETS[0].name);
    expect(presetById('없는-서식')).toBeUndefined();
  });

  it('글머리표와 문장 종결 추천 값을 함께 제공한다', () => {
    expect(BULLET_STYLE_OPTIONS.length).toBeGreaterThan(0);
    expect(ENDING_STYLE_OPTIONS.length).toBeGreaterThan(0);
    expect(new Set(BULLET_STYLE_OPTIONS).size).toBe(BULLET_STYLE_OPTIONS.length);
    expect(new Set(ENDING_STYLE_OPTIONS).size).toBe(ENDING_STYLE_OPTIONS.length);
  });
});
