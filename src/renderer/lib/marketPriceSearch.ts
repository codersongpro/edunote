// 네이버 쇼핑 검색 API가 2026년 7월 31일 종료되어 상품 단가를 직접 받아올 수 있는
// 무료 공개 API가 없어졌다. 나라장터 종합쇼핑몰에 없는 일반 시중 물품은 AI 웹 검색으로
// 참고 단가를 조사한다. 검색 결과는 시점·판매처에 따라 달라지므로 항상 "참고용"이며,
// 사용자가 출처를 직접 확인할 수 있도록 링크를 함께 보여준다.

import { parseJsonArrayFromAiText } from './aiJson';

export interface MarketPriceItem {
  // 품목명
  name: string;
  // 규격·용량 등 구분 정보
  spec: string;
  // 제조사 또는 판매처
  maker: string;
  // 참고 단가(원)
  unitPrice: number;
  // 가격을 확인할 수 있는 출처 주소
  sourceUrl: string;
}

// 참고 단가임을 결과 목록에서 바로 알 수 있도록 붙이는 출처 이름
export const MARKET_PRICE_SOURCE_LABEL = '웹 검색 참고가';

export const MARKET_PRICE_SYSTEM_INSTRUCTION =
  '너는 한국 학교 예산 담당자를 돕는 조사 보조자다. 웹 검색으로 확인한 실제 판매 가격만 정리하고, 확인하지 못한 가격은 만들지 않는다.';

export function buildMarketPriceSearchPrompt(keyword: string, count = 8): string {
  return [
    `학교에서 구입할 "${keyword}"의 현재 시중 판매 가격을 웹 검색으로 조사해줘.`,
    '반드시 웹 검색을 실행하고, 실제로 확인한 판매 페이지의 가격만 사용해.',
    `서로 다른 제품 ${count}개 이내로 정리해.`,
    '반드시 JSON 배열만 응답해. 설명, 마크다운, 코드블록은 쓰지 마.',
    '각 항목 필드: name, spec, maker, unitPrice, sourceUrl',
    '- name: 품목명 (같은 제품을 여러 번 넣지 마)',
    '- spec: 규격·용량·수량 단위 (없으면 빈 문자열)',
    '- maker: 제조사 또는 판매처 (없으면 빈 문자열)',
    '- unitPrice: 1개 기준 판매가를 원 단위 양의 정수로. 쉼표·원 표시·범위 표기 금지',
    '- sourceUrl: 그 가격을 확인한 웹 페이지의 http/https 주소',
    '가격을 확인하지 못한 제품은 목록에서 빼고, 추정 가격을 만들어 넣지 마.',
    '배송비·설치비는 빼고 제품 가격만 적어.',
  ].join('\n');
}

const MAX_REASONABLE_PRICE = 100_000_000;

function toPositiveInteger(value: unknown): number {
  // "12,900원", "12900", 12900 형태를 모두 받아 정수로 만든다.
  const digits = String(value ?? '').replace(/[^0-9]/g, '');
  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_REASONABLE_PRICE) return 0;
  return parsed;
}

function toHttpUrl(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function toText(value: unknown): string {
  return String(value ?? '').trim();
}

// AI 응답에서 참고 단가 목록을 꺼낸다. 단가나 이름이 없는 항목, 같은 이름과 단가가
// 반복되는 항목은 버린다. 형식이 아예 어긋나면 parseJsonArrayFromAiText가 오류를 던진다.
export function parseMarketPriceItems(text: string): MarketPriceItem[] {
  const rows = parseJsonArrayFromAiText(text);
  const seen = new Set<string>();
  const items: MarketPriceItem[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const name = toText(record.name);
    const unitPrice = toPositiveInteger(record.unitPrice);
    if (!name || unitPrice === 0) continue;

    const key = `${name}-${unitPrice}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      name,
      spec: toText(record.spec),
      maker: toText(record.maker),
      unitPrice,
      sourceUrl: toHttpUrl(record.sourceUrl),
    });
  }

  return items;
}
