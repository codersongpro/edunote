// 기관별 작성 서식의 기본 제공 목록.
//
// 그동안 기관 서식은 목차·글머리표·글자 크기·종결 방식을 교사가 빈칸에서 직접 채우고
// 저장해야만 쓸 수 있어 실제로 사용하기 어려웠다. 학교에서 흔히 쓰는 서식을 미리 담아
// 드롭다운에서 고르면 바로 적용되고, 고른 값을 그 자리에서 고쳐 쓰거나 처음부터 직접
// 입력할 수도 있게 한다.

import { DocType } from '../types';
import type { InstitutionFormat } from './workflowFeatures';

export interface InstitutionFormatPreset {
  id: string;
  name: string;
  // 어떤 문서에서 주로 쓰는 서식인지 — 해당 문서 탭에서 '추천 서식'으로 먼저 보여 준다.
  docTypes: DocType[];
  outline: string;
  bulletStyle: string;
  fontSize: number;
  endingStyle: string;
}

export const INSTITUTION_FORMAT_PRESETS: InstitutionFormatPreset[] = [
  {
    id: 'gongmun-basic',
    name: '교육청 공문(기안문) 기본형',
    docTypes: [DocType.GONGMUN],
    outline: '1. 관련 / 2. 본문(시행문) + 개요(가. 나. 다.) / 붙임',
    bulletStyle: '1. → 가. → 1) → 가)',
    fontSize: 15,
    endingStyle: '합쇼체(~합니다, ~바랍니다)',
  },
  {
    id: 'pumui-basic',
    name: '지출품의서 기본형',
    docTypes: [DocType.PUMUI],
    outline: '1. 관련 / 2. 본문(품의) + 가. 내역 나. 용도 다. 소요예산 라. 산출내역 / 붙임',
    bulletStyle: '1. → 가. → 1)',
    fontSize: 13,
    endingStyle: '합쇼체(~합니다, ~하고자 합니다)',
  },
  {
    id: 'plan-number',
    name: '학교 계획서(번호식)',
    docTypes: [DocType.PLAN],
    outline: '1. 추진 배경 / 2. 목적 / 3. 운영 방침 / 4. 세부 추진 계획 / 5. 소요 예산 / 6. 기대 효과',
    bulletStyle: '1. → 가. → 1) → 가)',
    fontSize: 13,
    endingStyle: '명사형 개조식(~함, ~임)',
  },
  {
    id: 'plan-roman',
    name: '학교 계획서(로마숫자 목차)',
    docTypes: [DocType.PLAN],
    outline: 'Ⅰ. 목적 / Ⅱ. 방침 / Ⅲ. 세부 추진 계획 / Ⅳ. 소요 예산 / Ⅴ. 기대 효과',
    bulletStyle: 'Ⅰ. → 가. → 1) → 가)',
    fontSize: 13,
    endingStyle: '명사형 개조식(~함, ~임)',
  },
  {
    id: 'report-basic',
    name: '사업 결과 보고서',
    docTypes: [DocType.REPORT],
    outline: '1. 추진 개요 / 2. 추진 실적 / 3. 세부 운영 결과 / 4. 예산 집행 / 5. 성과 및 제언',
    bulletStyle: '1. → 가. → 1)',
    fontSize: 13,
    endingStyle: '명사형 개조식(~함, ~임)',
  },
  {
    id: 'training-basic',
    name: '교직원 연수자료',
    docTypes: [DocType.TRAINING_MATERIAL],
    outline: '1. 핵심 개념 / 2. 학교 적용 기준 / 3. 사례와 유의 사항 / 4. 점검 목록',
    bulletStyle: '1. → 가. → 1)',
    fontSize: 13,
    endingStyle: '명사형 개조식(~함, ~임, ~기준임)',
  },
  {
    id: 'minutes-table',
    name: '회의록(표 형식)',
    docTypes: [DocType.MEETING_MINUTES],
    outline: '일시·장소·참석자 표 / 회의 안건 / 회의 내용(발언자별) / 결정 사항',
    bulletStyle: '가. → 1)',
    fontSize: 12,
    endingStyle: '발언은 존댓말, 결정 사항은 명사형(~함)',
  },
  {
    id: 'newsletter-basic',
    name: '가정통신문(안내문)',
    docTypes: [DocType.NEWSLETTER, DocType.MESSAGE],
    outline: '인사말 / 안내 내용 / 가정 협조 사항 / 문의처 / 발신 명의',
    bulletStyle: '■ → -',
    fontSize: 13,
    endingStyle: '존댓말(~합니다, ~바랍니다)',
  },
  {
    id: 'gonggo-basic',
    name: '공고문 기본형',
    docTypes: [DocType.GONGGO],
    outline: '1. 공고 개요 / 2. 신청 자격 / 3. 접수 방법 및 기간 / 4. 심사 및 결과 발표 / 5. 문의처',
    bulletStyle: '1. → 가. → 1)',
    fontSize: 13,
    endingStyle: '합쇼체(~합니다)',
  },
  {
    id: 'promotion-press',
    name: '보도자료',
    docTypes: [DocType.PROMOTION],
    outline: '헤드라인 / 부제 / 리드 문단 / 본문 전개 / 관계자 인용 / 문의처',
    bulletStyle: '■',
    fontSize: 13,
    endingStyle: '기사체 평서형(~했다, ~밝혔다)',
  },
];

// 글머리표·문장 종결은 자유 입력이지만, 자주 쓰는 값을 목록으로 함께 보여 준다.
export const BULLET_STYLE_OPTIONS = [
  '1. → 가. → 1) → 가)',
  'Ⅰ. → 가. → 1) → 가)',
  '1. → 1.1 → 1.1.1',
  '■ → -',
  '● → -',
  '- (하이픈만)',
];

export const ENDING_STYLE_OPTIONS = [
  '명사형 개조식(~함, ~임)',
  '합쇼체(~합니다, ~바랍니다)',
  '존댓말(~합니다, ~드립니다)',
  '기사체 평서형(~했다, ~밝혔다)',
  '해요체(~해요)',
];

// 현재 문서 종류에 맞는 서식을 먼저, 나머지를 뒤에 보여 준다.
export function presetsForDocType(docType: DocType): {
  recommended: InstitutionFormatPreset[];
  others: InstitutionFormatPreset[];
} {
  return {
    recommended: INSTITUTION_FORMAT_PRESETS.filter(preset => preset.docTypes.includes(docType)),
    others: INSTITUTION_FORMAT_PRESETS.filter(preset => !preset.docTypes.includes(docType)),
  };
}

export function presetById(id: string): InstitutionFormatPreset | undefined {
  return INSTITUTION_FORMAT_PRESETS.find(preset => preset.id === id);
}

export type InstitutionFormatDraft = Omit<InstitutionFormat, 'id' | 'docType'>;

export const EMPTY_INSTITUTION_FORMAT_DRAFT: InstitutionFormatDraft = {
  name: '',
  outline: '',
  bulletStyle: '',
  fontSize: 13,
  endingStyle: '',
};

export function draftFromPreset(preset: InstitutionFormatPreset): InstitutionFormatDraft {
  return {
    name: preset.name,
    outline: preset.outline,
    bulletStyle: preset.bulletStyle,
    fontSize: preset.fontSize,
    endingStyle: preset.endingStyle,
  };
}
