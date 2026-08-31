import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BudgetCategory, BudgetItem, BudgetPlan } from '../types';
import { playSuccessSound } from '../lib/soundEffect';
import { parseJsonArrayFromAiText } from '../lib/aiJson';
import { readApiItemCount, readNumericFieldSamples } from '../lib/openApiItems';
import { extractNaraIdNo, formatItemNameWithIdNo, pickNaraIdNo } from '../lib/budgetItemName';
import { toNaraImageUrl } from '../lib/naraImage';
import { toCsv } from '../lib/csv';
import {
  MARKET_PRICE_SOURCE_LABEL,
  MARKET_PRICE_SYSTEM_INSTRUCTION,
  buildMarketPriceSearchPrompt,
  parseMarketPriceItems,
} from '../lib/marketPriceSearch';
import { useTour } from '../TourContext';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  ExternalLink,
  HelpCircle,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';

const CATEGORIES: BudgetCategory[] = ['교육운영비', '일반운영비', '업무추진비'];
const DEFAULT_BUDGET_TITLE = '2026. 디지털선도학교 운영 예산';
const DEFAULT_BUDGET_TOTAL = '10,000,000';
const BUDGET_PLANNER_STATE_KEY = 'budget-planner-state';
const BUDGET_NOTEBOOK_LM_URL = 'https://notebooklm.google.com/notebook/1219f9f1-d26d-4e02-bc29-01a04feb15fb';

const CATEGORY_COLORS: Record<BudgetCategory, { row: string; childRow: string; grandChildRow: string; cell: string; select: string; footer: string }> = {
  교육운영비: {
    row: 'bg-sky-50/70 dark:bg-sky-950/20 hover:bg-sky-100/80 dark:hover:bg-sky-900/30',
    childRow: 'bg-sky-50/45 dark:bg-sky-950/14 hover:bg-sky-100/55 dark:hover:bg-sky-900/22',
    grandChildRow: 'bg-sky-50/25 dark:bg-sky-950/10 hover:bg-sky-100/40 dark:hover:bg-sky-900/16',
    cell: 'bg-sky-100 dark:bg-sky-900/50 text-sky-900 dark:text-sky-100',
    select: 'bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-100',
    footer: 'bg-sky-50 dark:bg-sky-950/30',
  },
  일반운영비: {
    row: 'bg-emerald-50/70 dark:bg-emerald-950/20 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/30',
    childRow: 'bg-emerald-50/45 dark:bg-emerald-950/14 hover:bg-emerald-100/55 dark:hover:bg-emerald-900/22',
    grandChildRow: 'bg-emerald-50/25 dark:bg-emerald-950/10 hover:bg-emerald-100/40 dark:hover:bg-emerald-900/16',
    cell: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-100',
    select: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100',
    footer: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  업무추진비: {
    row: 'bg-amber-50/70 dark:bg-amber-950/20 hover:bg-amber-100/80 dark:hover:bg-amber-900/30',
    childRow: 'bg-amber-50/45 dark:bg-amber-950/14 hover:bg-amber-100/55 dark:hover:bg-amber-900/22',
    grandChildRow: 'bg-amber-50/25 dark:bg-amber-950/10 hover:bg-amber-100/40 dark:hover:bg-amber-900/16',
    cell: 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100',
    select: 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-100',
    footer: 'bg-amber-50 dark:bg-amber-950/30',
  },
};

const CATEGORY_KEYWORDS: Record<BudgetCategory, string[]> = {
  교육운영비: ['에듀테크 라이선스', '학생 간식', '학생 기념품', '행사 예산'],
  일반운영비: ['AI 라이선스', '강사비', '원고비', '홍보용품', '현수막'],
  업무추진비: ['식비', '다과비'],
};

const LOCAL_CATALOG: Record<BudgetCategory, NaraItem[]> = {
  교육운영비: [
    { thngNm: '학급 문고 도서', thngCd: 'local-book', spec: '권', unitPrice: 20000 },
    { thngNm: '학습 활동지 인쇄 세트', thngCd: 'local-worksheet', spec: '묶음', unitPrice: 10000 },
    { thngNm: '색연필 세트', thngCd: 'local-colored-pencil', spec: '12색', unitPrice: 7000 },
    { thngNm: '수채화 물감', thngCd: 'local-paint', spec: '12색', unitPrice: 8500 },
    { thngNm: '도화지', thngCd: 'local-paper-art', spec: '100매', unitPrice: 9000 },
    { thngNm: '과학 실험 키트', thngCd: 'local-science-kit', spec: '개', unitPrice: 20000 },
    { thngNm: '줄넘기', thngCd: 'local-rope', spec: '개', unitPrice: 6000 },
    { thngNm: '학습용 보드게임', thngCd: 'local-boardgame', spec: '개', unitPrice: 20000 },
    { thngNm: 'USB 메모리', thngCd: 'local-usb', spec: '32GB', unitPrice: 9000 },
  ],
  일반운영비: [
    { thngNm: '복사용지', thngCd: 'local-copy-paper', spec: 'A4 2500매', unitPrice: 30000 },
    { thngNm: '볼펜', thngCd: 'local-pen', spec: '12개입', unitPrice: 6000 },
    { thngNm: '클리어 파일', thngCd: 'local-clear-file', spec: '20매', unitPrice: 5000 },
    { thngNm: '바인더', thngCd: 'local-binder', spec: '개', unitPrice: 4500 },
    { thngNm: '스테이플러', thngCd: 'local-stapler', spec: '개', unitPrice: 8000 },
    { thngNm: '테이프', thngCd: 'local-tape', spec: '3개입', unitPrice: 4500 },
    { thngNm: '프린터 토너', thngCd: 'local-toner', spec: '개', unitPrice: 90000 },
    { thngNm: '청소용품 세트', thngCd: 'local-cleaning', spec: '세트', unitPrice: 20000 },
    { thngNm: '손세정제', thngCd: 'local-sanitizer', spec: '500ml', unitPrice: 7000 },
    { thngNm: 'AI 문서 작성 라이선스', thngCd: 'local-ai-doc', spec: '1년 구독', unitPrice: 500000 },
    { thngNm: 'AI 콘텐츠 제작 라이선스', thngCd: 'local-ai-content', spec: '1년 구독', unitPrice: 400000 },
    { thngNm: '강사비', thngCd: 'local-lecture-fee', spec: '운영수당', unitPrice: 180000 },
    { thngNm: '원고비', thngCd: 'local-writing-fee', spec: '운영수당', unitPrice: 100000 },
    { thngNm: '홍보용품', thngCd: 'local-promo', spec: '홍보 물품', unitPrice: 260000 },
    { thngNm: '현수막', thngCd: 'local-banner', spec: '홍보물', unitPrice: 200000 },
  ],
  업무추진비: [
    { thngNm: '커피', thngCd: 'local-coffee', spec: '박스', unitPrice: 20000 },
    { thngNm: '차 세트', thngCd: 'local-tea', spec: '박스', unitPrice: 20000 },
    { thngNm: '생수', thngCd: 'local-water', spec: '묶음', unitPrice: 7000 },
    { thngNm: '음료', thngCd: 'local-drink', spec: '박스', unitPrice: 20000 },
    { thngNm: '쿠키', thngCd: 'local-cookie', spec: '상자', unitPrice: 10000 },
    { thngNm: '과자 세트', thngCd: 'local-snack', spec: '상자', unitPrice: 10000 },
    { thngNm: '회의용 다과', thngCd: 'local-meeting-snack', spec: '세트', unitPrice: 30000 },
    { thngNm: '기념품 수건', thngCd: 'local-towel', spec: '개', unitPrice: 5000 },
  ],
};

const TITLE_HINTS: Record<string, Partial<Record<BudgetCategory, string[]>>> = {
  독서: { 교육운영비: ['도서', '학급 문고 도서'] },
  도서: { 교육운영비: ['도서', '학급 문고 도서'] },
  과학: { 교육운영비: ['실험', '과학 실험 키트'] },
  미술: { 교육운영비: ['색연필', '물감', '도화지'] },
  체육: { 교육운영비: ['줄넘기'] },
  음악: { 교육운영비: ['이어폰', '헤드셋', '스피커', '마이크'] },
  방송: { 교육운영비: ['이어폰', '헤드셋', '마이크', '스피커'] },
  어학: { 교육운영비: ['이어폰', '헤드셋', '마이크'] },
  온라인: { 교육운영비: ['이어폰', '헤드셋', '마이크', '웹캠'] },
  원격: { 교육운영비: ['이어폰', '헤드셋', '마이크', '웹캠'] },
  컴퓨터: { 교육운영비: ['USB', '마우스', '키보드', '헤드셋'] },
  디지털: { 교육운영비: ['USB', '이어폰', '헤드셋', '마우스', '키보드'] },
  학급: { 교육운영비: ['학습', '도서'], 일반운영비: ['복사용지', '파일'] },
  사무: { 일반운영비: ['복사용지', '볼펜', '파일'] },
  디지털선도학교: { 교육운영비: ['에듀테크', '학생 간식', '행사'], 일반운영비: ['AI 라이선스', '강사비', '원고비', '홍보용품', '현수막'] },
  회의: { 업무추진비: ['커피', '차', '회의용 다과'] },
  협의: { 업무추진비: ['커피', '차', '회의용 다과'] },
};

const DESIRED_ITEM_HINTS: Record<string, string[]> = {
  에듀테크: ['태블릿', '스마트패드', '스마트기기', '코딩교구', '로봇교구', '디지털 교구', '충전기', '보관함'],
  디지털: ['태블릿', '스마트패드', '스마트기기', '코딩교구', 'USB', '마우스', '키보드'],
  스마트: ['태블릿', '스마트패드', '스마트기기', '충전기', '보관함'],
  교구: ['학습교구', '수학교구', '과학교구', '보드게임', '실험키트', '조작교구'],
  다과: ['다과', '간식', '과자', '쿠키', '음료', '차', '커피'],
  식비: ['도시락', '식비', '간식', '음료', '다과'],
  간식: ['간식', '과자', '쿠키', '음료', '다과'],
  라이선스: ['AI 라이선스', '에듀테크 라이선스', '구독'],
  강사비: ['강사비', '운영수당'],
  원고비: ['원고비', '운영수당'],
  홍보: ['홍보용품', '현수막', '홍보물'],
};

const TITLE_DIRECT_ITEMS: Record<string, Partial<Record<BudgetCategory, NaraItem[]>>> = {
  이어폰: {
    교육운영비: [
      { thngNm: '이어폰', thngCd: 'title-earphone', spec: '학습용', unitPrice: 10000, preferred: true },
      { thngNm: '헤드셋', thngCd: 'title-headset', spec: '어학·온라인 학습용', unitPrice: 30000, preferred: true },
    ],
  },
  헤드셋: {
    교육운영비: [
      { thngNm: '헤드셋', thngCd: 'title-headset', spec: '어학·온라인 학습용', unitPrice: 30000, preferred: true },
      { thngNm: '이어폰', thngCd: 'title-earphone', spec: '학습용', unitPrice: 10000, preferred: true },
    ],
  },
  마이크: {
    교육운영비: [
      { thngNm: '마이크', thngCd: 'title-mic', spec: '수업·방송용', unitPrice: 40000, preferred: true },
      { thngNm: '헤드셋', thngCd: 'title-headset', spec: '마이크 포함', unitPrice: 30000, preferred: true },
    ],
  },
  복사용지: {
    일반운영비: [
      { thngNm: '복사용지', thngCd: 'title-copy-paper', spec: 'A4 2500매', unitPrice: 30000, preferred: true },
    ],
  },
  디지털선도학교: {
    교육운영비: [
      { thngNm: '패들렛', thngCd: 'title-padlet', spec: '1년 구독', unitPrice: 1500000, preferred: true },
      { thngNm: '젭퀴즈', thngCd: 'title-zepquiz', spec: '1년 구독', unitPrice: 1500000, preferred: true },
      { thngNm: 'AI 코스웨어 라이선스', thngCd: 'title-ai-courseware', spec: '1년 구독', unitPrice: 2000000, preferred: true },
      { thngNm: '수업 참여 간식', thngCd: 'title-student-snack', spec: '행사 및 수업 참여 간식', unitPrice: 5000, preferred: true },
      { thngNm: '참여 학생 기념품', thngCd: 'title-student-gift', spec: '기념품', unitPrice: 5000, preferred: true },
    ],
    일반운영비: [
      { thngNm: 'AI 문서 작성 라이선스', thngCd: 'title-ai-doc', spec: '1년 구독', unitPrice: 500000, preferred: true },
      { thngNm: 'AI 콘텐츠 제작 라이선스', thngCd: 'title-ai-content', spec: '1년 구독', unitPrice: 400000, preferred: true },
      { thngNm: '강사비', thngCd: 'title-lecture-fee', spec: '운영수당', unitPrice: 180000, preferred: true },
      { thngNm: '원고비', thngCd: 'title-writing-fee', spec: '운영수당', unitPrice: 100000, preferred: true },
      { thngNm: '홍보용품', thngCd: 'title-promo', spec: '홍보 물품', unitPrice: 260000, preferred: true },
      { thngNm: '현수막', thngCd: 'title-banner', spec: '홍보물', unitPrice: 200000, preferred: true },
    ],
    업무추진비: [
      { thngNm: '식비', thngCd: 'title-meal', spec: '협의회 식비', unitPrice: 350000, preferred: true },
      { thngNm: '다과비', thngCd: 'title-refreshment', spec: '협의회 다과', unitPrice: 150000, preferred: true },
    ],
  },
};

interface NaraItem {
  thngNm: string;
  thngCd: string;
  spec?: string;
  mnfctCorpNm?: string;
  unitPrice?: number;
  preferred?: boolean;
  priceSource?: string;
  priceSourceUrl?: string;
  image?: string;
}

type RecommendationStatus = 'idle' | 'loading' | 'ready' | 'error';

type BudgetPlannerState = {
  activePlanId?: string;
  totalBudget?: string;
  planTitle?: string;
  useCategoryRatio?: boolean;
  ratioEdu?: string;
  ratioGeneral?: string;
  ratioBiz?: string;
  keywordEdu?: string;
  keywordGeneral?: string;
  keywordBiz?: string;
  keywordFree?: string;
};

const AUTO_BALANCE_MEMO = 'auto-balance-adjustment';
const SMALL_BALANCE_LIMIT = 50000;
const MAX_BUDGET_DEPTH = 3;
const EXCLUDED_AUTO_ITEM_WORDS = ['상품권', '문화상품권', '기프트카드', '모바일쿠폰', '모바일 쿠폰', '기프티콘'];
const SCHOOL_ACCOUNTING_GUIDE = [
  '학교회계 과목 기준:',
  '일반운영비: 학교 공통 운영 경비. 일반수용비(사무용품, 인쇄비, 소모성 물품, 수수료, 임차료), 운영수당(강사수당, 위원회 수당, 원고비), 공공요금, 급식 관련, 교직원 경비.',
  '교육운영비: 학생의 직접 교과 및 교육활동 지원 경비. 교육용 재료, 교구 및 기자재 유지보수, 학생 체험비, 숙박식비, 행사비, 학습준비물, 학생복지비.',
  '업무추진비: 학교 운영, 유관기관 협조, 직무 수행, 목적사업 추진을 위한 일반업무추진비, 직책급 업무수행경비, 목적사업 업무추진비.',
].join('\n');

const SMALL_BALANCE_CATALOG: Record<BudgetCategory, NaraItem[]> = {
  교육운영비: [
    { thngNm: '학습 스티커', thngCd: 'balance-learning-sticker', spec: '', unitPrice: 500 },
    { thngNm: '색종이', thngCd: 'balance-color-paper', spec: '', unitPrice: 1000 },
    { thngNm: '학습 파일', thngCd: 'balance-learning-file', spec: '', unitPrice: 2000 },
    { thngNm: '학습 노트', thngCd: 'balance-learning-note', spec: '', unitPrice: 3000 },
    { thngNm: '학습 준비물', thngCd: 'balance-learning-supply', spec: '', unitPrice: 5000 },
  ],
  일반운영비: [
    { thngNm: '클립', thngCd: 'balance-clip', spec: '', unitPrice: 500 },
    { thngNm: '라벨지', thngCd: 'balance-label', spec: '', unitPrice: 1000 },
    { thngNm: '파일철', thngCd: 'balance-file-folder', spec: '', unitPrice: 2000 },
    { thngNm: '사무용품', thngCd: 'balance-office-supply', spec: '', unitPrice: 3000 },
    { thngNm: '정리용품', thngCd: 'balance-organizer', spec: '', unitPrice: 5000 },
  ],
  업무추진비: [
    { thngNm: '종이컵', thngCd: 'balance-paper-cup', spec: '', unitPrice: 500 },
    { thngNm: '생수', thngCd: 'balance-water', spec: '', unitPrice: 1000 },
    { thngNm: '다과', thngCd: 'balance-refreshment', spec: '', unitPrice: 2000 },
    { thngNm: '간식', thngCd: 'balance-snack', spec: '', unitPrice: 3000 },
    { thngNm: '회의 음료', thngCd: 'balance-meeting-drink', spec: '', unitPrice: 5000 },
  ],
};

const fmt = (n: number) => n.toLocaleString('ko-KR');
const genId = () => crypto.randomUUID();
const inputCls = 'w-full px-3 py-1.5 text-sm border border-[#E7E5E4] dark:border-[#2E2822] rounded-lg bg-white dark:bg-[#171210] text-[#1C1917] dark:text-[#F0EBE6] focus:outline-none focus:ring-2 focus:ring-blue-500';
const btnCls = 'px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-40';

function parseMoney(value: string): number {
  return parseInt(value.replace(/,/g, ''), 10) || 0;
}

function moneyInput(value: string): string {
  return value.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function calcSubtotal(item: Pick<BudgetItem, 'unitPrice' | 'quantity'>): number {
  return Math.max(0, item.unitPrice) * Math.max(1, item.quantity);
}

function isExcludedAutoItemName(name: string): boolean {
  const normalized = name.replace(/\s/g, '');
  return EXCLUDED_AUTO_ITEM_WORDS.some(word => normalized.includes(word.replace(/\s/g, '')));
}

function normalizeBudgetCategory(value: unknown): BudgetCategory | null {
  if (value === '일반수용비') return '일반운영비';
  return CATEGORIES.includes(value as BudgetCategory) ? value as BudgetCategory : null;
}

function parentIdsWithChildren(items: BudgetItem[]): Set<string> {
  return new Set(items.map(item => item.parentId).filter((id): id is string => !!id));
}

function displaySubtotal(item: BudgetItem, items: BudgetItem[]): number {
  const children = items.filter(child => child.parentId === item.id);
  if (children.length === 0) return item.subtotal;
  return children.reduce((sum, child) => sum + displaySubtotal(child, items), 0);
}

function countableItems(items: BudgetItem[]): BudgetItem[] {
  const parentIds = parentIdsWithChildren(items);
  return items.filter(item => !parentIds.has(item.id));
}

function getItemDepth(items: BudgetItem[], item: BudgetItem): number {
  let depth = 1;
  let parentId = item.parentId;
  while (parentId && depth < 10) {
    depth += 1;
    parentId = items.find(row => row.id === parentId)?.parentId;
  }
  return depth;
}

function collectDescendantIds(items: BudgetItem[], id: string): Set<string> {
  const result = new Set<string>();
  const visit = (parentId: string) => {
    for (const child of items.filter(item => item.parentId === parentId)) {
      result.add(child.id);
      visit(child.id);
    }
  };
  visit(id);
  return result;
}

function hasCollapsedAncestor(items: BudgetItem[], item: BudgetItem, collapsedIds: Set<string>): boolean {
  let parentId = item.parentId;
  while (parentId) {
    if (collapsedIds.has(parentId)) return true;
    parentId = items.find(row => row.id === parentId)?.parentId;
  }
  return false;
}

function budgetRowClass(categoryColor: (typeof CATEGORY_COLORS)[BudgetCategory], depth: number): string {
  if (depth >= 3) return categoryColor.grandChildRow;
  if (depth === 2) return categoryColor.childRow;
  return categoryColor.row;
}

function normalizeQuantity(value: number | undefined, minQuantity?: number, maxQuantity?: number): number {
  const min = Math.max(1, minQuantity || 1);
  const max = maxQuantity && maxQuantity >= min ? maxQuantity : undefined;
  return Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min, value || min));
}

function makeItem(category: BudgetCategory, item?: Partial<NaraItem>): BudgetItem {
  const unitPrice = item?.unitPrice ?? 0;
  const quantity = 1;
  return {
    id: genId(),
    budgetCategory: category,
    thngNm: item?.thngNm || '',
    thngCd: item?.thngCd || '',
    spec: item?.spec || '',
    unitPrice,
    quantity,
    subtotal: unitPrice * quantity,
    priceSource: item?.priceSource,
    priceSourceUrl: item?.priceSourceUrl,
  };
}

function makeBudgetItem(category: BudgetCategory, thngNm: string, spec: string, unitPrice: number, quantity: number, parentId?: string): BudgetItem {
  const item = makeItem(category, { thngNm, spec, unitPrice, thngCd: 'example-draft' });
  item.quantity = quantity;
  item.subtotal = calcSubtotal(item);
  item.parentId = parentId;
  return item;
}

function buildExampleBudgetItems(): BudgetItem[] {
  const rows: BudgetItem[] = [];
  const roots: Record<BudgetCategory, BudgetItem> = {
    교육운영비: makeCategoryRow('교육운영비'),
    일반운영비: makeCategoryRow('일반운영비'),
    업무추진비: makeCategoryRow('업무추진비'),
  };
  for (const category of CATEGORIES) rows.push(roots[category]);

  const add = (category: BudgetCategory, thngNm: string, spec: string, unitPrice: number, quantity: number) => {
    const item = makeBudgetItem(category, thngNm, spec, unitPrice, quantity, roots[category].id);
    rows.push(item);
    return item;
  };

  // 교육운영비 (카테고리 > 품목, 2단계)
  add('교육운영비', '패들렛', '1년 구독', 1500000, 1);
  add('교육운영비', '젭퀴즈', '1년 구독', 1500000, 1);
  add('교육운영비', 'AI 코스웨어 라이선스', '1년 구독', 2000000, 1);
  add('교육운영비', '수업 참여 간식', '행사 및 수업 참여 간식', 5000, 120);
  add('교육운영비', '참여 학생 기념품', '기념품', 5000, 80);
  add('교육운영비', '디지털 수업 나눔 행사 운영', '1식', 800000, 1);
  add('교육운영비', '성과 공유회 운영', '1식', 500000, 1);
  add('교육운영비', '체험 부스 운영', '1식', 200000, 1);

  // 일반운영비
  add('일반운영비', 'AI 문서 작성 라이선스', '1년 구독', 500000, 1);
  add('일반운영비', 'AI 콘텐츠 제작 라이선스', '1년 구독', 400000, 1);
  add('일반운영비', '강사비', '운영수당', 180000, 3);
  add('일반운영비', '원고비', '운영수당', 100000, 1);
  add('일반운영비', '홍보용품', '홍보 물품', 260000, 1);
  add('일반운영비', '현수막', '홍보물', 200000, 1);

  // 업무추진비
  add('업무추진비', '식비', '협의회 식비', 350000, 1);
  add('업무추진비', '다과비', '협의회 다과', 150000, 1);

  return normalizeToCategoryTree(rows);
}

function makeSmallBalanceItem(category: BudgetCategory, candidate: NaraItem, quantity: number): BudgetItem {
  const item = makeItem(category, candidate);
  item.quantity = Math.max(1, quantity);
  item.subtotal = calcSubtotal(item);
  item.memo = AUTO_BALANCE_MEMO;
  item.quantityAdjusted = true;
  return item;
}

function pickSmallBalanceItems(category: BudgetCategory, gap: number): BudgetItem[] {
  if (gap <= 0 || gap > SMALL_BALANCE_LIMIT) return [];
  const candidates = [...SMALL_BALANCE_CATALOG[category]]
    .filter(item => (item.unitPrice ?? 0) > 0)
    .sort((a, b) => (b.unitPrice ?? 0) - (a.unitPrice ?? 0));
  const picked: BudgetItem[] = [];
  let remaining = gap;

  for (const candidate of candidates) {
    const unitPrice = candidate.unitPrice ?? 0;
    const quantity = Math.floor(remaining / unitPrice);
    if (quantity <= 0) continue;
    picked.push(makeSmallBalanceItem(category, candidate, quantity));
    remaining -= unitPrice * quantity;
    if (remaining === 0) break;
  }

  const smallest = candidates[candidates.length - 1];
  if (smallest && remaining > 0 && Math.abs(remaining - (smallest.unitPrice ?? 0)) < remaining) {
    picked.push(makeSmallBalanceItem(category, smallest, 1));
  }

  return picked;
}

function uniqueItems(items: NaraItem[]): NaraItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.thngCd}-${item.thngNm}-${item.unitPrice}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return !!item.thngNm && !isExcludedAutoItemName(item.thngNm) && (item.unitPrice ?? 0) > 0;
  });
}

function buildRecommendation(candidates: Record<BudgetCategory, NaraItem[]>, allocations: Record<BudgetCategory, number>): BudgetItem[] {
  const result: BudgetItem[] = [];
  for (const category of CATEGORIES) {
    let remaining = allocations[category];
    const priced = uniqueItems(candidates[category])
      .filter(item => (item.unitPrice ?? 0) > 0 && (item.unitPrice ?? 0) <= allocations[category])
      .sort((a, b) => Number(!!b.preferred) - Number(!!a.preferred) || (b.unitPrice ?? 0) - (a.unitPrice ?? 0));

    for (const candidate of priced.slice(0, 18)) {
      if (remaining <= 0) break;
      const unitPrice = candidate.unitPrice ?? 0;
      if (unitPrice <= 0 || unitPrice > remaining) continue;
      const quantity = Math.max(1, Math.floor(remaining / unitPrice));
      const subtotal = unitPrice * quantity;
      result.push({
        ...makeItem(category, candidate),
        quantity,
        subtotal,
      });
      remaining -= subtotal;
    }
  }
  return result;
}

function estimateUnitPrice(category: BudgetCategory, itemName: string): number {
  const name = itemName.replace(/\s/g, '');
  if (/에듀테크|태블릿|스마트패드|스마트기기/.test(name)) return 300000;
  if (/코딩교구|로봇교구|디지털교구/.test(name)) return 80000;
  if (/교구|학습교구|수학교구|과학교구|조작교구/.test(name)) return 30000;
  if (/식비|도시락/.test(name)) return 10000;
  if (/다과|간식|과자|쿠키|음료/.test(name)) return 20000;
  if (/토너|프린터|카트리지/.test(name)) return 90000;
  if (/키트|세트|보드게임|다과/.test(name)) return 30000;
  if (/도서|책|교재/.test(name)) return 20000;
  if (/복사용지|용지/.test(name)) return 30000;
  if (/커피|음료|차|과자|쿠키/.test(name)) return 20000;
  if (/파일|테이프|볼펜|펜|수건/.test(name)) return 6000;
  if (category === '일반운영비') return 10000;
  if (category === '업무추진비') return 20000;
  return 10000;
}

function splitDesiredItems(value: string): string[] {
  return value
    .split(/[,，\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function expandDesiredWords(words: string[]): string[] {
  const expanded: string[] = [];
  for (const word of words) {
    expanded.push(word);
    const normalized = word.replace(/\s/g, '');
    for (const [hint, additions] of Object.entries(DESIRED_ITEM_HINTS)) {
      if (normalized.includes(hint) || hint.includes(normalized)) {
        expanded.push(...additions);
      }
    }
  }
  return Array.from(new Set(expanded.filter(Boolean)));
}

function getTitleKeywords(title: string): Partial<Record<BudgetCategory, string[]>> {
  const titleText = title.replace(/\s/g, '');
  const result: Partial<Record<BudgetCategory, string[]>> = {};
  for (const [hint, additions] of Object.entries(TITLE_HINTS)) {
    if (!titleText.includes(hint)) continue;
    for (const category of CATEGORIES) {
      const words = additions[category] ?? [];
      if (words.length === 0) continue;
      result[category] = [...(result[category] ?? []), ...words];
    }
  }
  for (const [hint, additions] of Object.entries(TITLE_DIRECT_ITEMS)) {
    if (!titleText.includes(hint)) continue;
    for (const category of CATEGORIES) {
      const words = (additions[category] ?? []).map(item => item.thngNm);
      if (words.length === 0) continue;
      result[category] = [...(result[category] ?? []), ...words];
    }
  }
  return Object.fromEntries(Object.entries(result).map(([category, words]) => [category, Array.from(new Set(words))])) as Partial<Record<BudgetCategory, string[]>>;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function readBudgetItemsFromCsv(text: string): { items: BudgetItem[]; totalBudget: number | null } {
  const rows = parseCsvRows(text);
  const headerIndex = rows.findIndex(row => row.includes('예산 과목') && row.includes('품목'));
  if (headerIndex < 0) throw new Error('예산안작성 CSV 형식이 아닙니다.');
  const header = rows[headerIndex].map(value => value.trim());
  const idx = (name: string) => header.indexOf(name);
  const categoryIdx = idx('예산 과목');
  const nameIdx = idx('품목');
  const specIdx = idx('규격');
  const priceIdx = idx('단가(원)');
  const qtyIdx = idx('수량');
  const subtotalIdx = idx('소계(원)');
  const items: BudgetItem[] = [];
  const lastByDepth = new Map<number, string>();
  const summaryLabels = ['합계', '배정 예산', '잔액', '집행 합계'];
  let totalBudget: number | null = null;

  for (const row of rows.slice(headerIndex + 1)) {
    const rawName = row[nameIdx] ?? '';
    const name = rawName.trim();
    const amount = parseInt((row[subtotalIdx] ?? '').replace(/[^0-9-]/g, ''), 10) || 0;
    if (name === '배정 예산') { totalBudget = amount; continue; }
    if (!name || summaryLabels.includes(name)) continue;

    const category = normalizeBudgetCategory(row[categoryIdx]?.trim());
    if (!category) continue;

    // 들여쓰기(앞 공백 3칸 = 1단계)로 트리 깊이를 복원한다.
    const leading = rawName.length - rawName.replace(/^\s+/, '').length;
    const depth = Math.min(MAX_BUDGET_DEPTH, Math.floor(leading / 3) + 1);

    // 카테고리 루트 행(1단계이며 품목명이 과목명과 같음)은 건너뛰고 정규화 단계에서 다시 만든다.
    if (depth <= 1 && name === category) { lastByDepth.clear(); continue; }

    const unitPrice = parseInt((row[priceIdx] ?? '').replace(/[^0-9]/g, ''), 10) || 0;
    const quantity = Math.max(1, parseInt((row[qtyIdx] ?? '').replace(/[^0-9]/g, ''), 10) || 1);
    // 2단계는 과목 루트(정규화 시 연결), 3단계는 바로 위 품목을 부모로 둔다.
    const parentId = depth > 2 ? lastByDepth.get(depth - 1) : undefined;
    const item: BudgetItem = {
      id: genId(),
      budgetCategory: category,
      thngNm: name,
      thngCd: '',
      spec: row[specIdx]?.trim() || '',
      unitPrice,
      quantity,
      subtotal: unitPrice * quantity,
      parentId,
    };
    items.push(item);
    lastByDepth.set(depth, item.id);
    for (const key of Array.from(lastByDepth.keys())) {
      if (key > depth) lastByDepth.delete(key);
    }
  }

  if (items.length === 0) throw new Error('불러올 품목 행이 없습니다.');
  return { items: normalizeToCategoryTree(items), totalBudget };
}

const CATEGORY_ROOT_CODE = 'category-root';

function isCategoryRow(item: BudgetItem): boolean {
  return item.thngCd === CATEGORY_ROOT_CODE || (!item.parentId && CATEGORIES.includes(item.thngNm as BudgetCategory));
}

function makeCategoryRow(category: BudgetCategory): BudgetItem {
  return {
    id: genId(),
    budgetCategory: category,
    thngNm: category,
    thngCd: CATEGORY_ROOT_CODE,
    spec: '',
    unitPrice: 0,
    quantity: 1,
    subtotal: 0,
  };
}

// 항상 교육운영비·일반운영비·업무추진비 3개 카테고리 행을 1단계 루트로 두고,
// 나머지 품목을 해당 과목 루트 아래(2단계, 필요 시 3단계)로 정리한다.
function normalizeToCategoryTree(items: BudgetItem[]): BudgetItem[] {
  const roots = new Map<BudgetCategory, BudgetItem>();
  const others: BudgetItem[] = [];
  for (const item of items) {
    if (isCategoryRow(item)) {
      if (!roots.has(item.budgetCategory)) {
        roots.set(item.budgetCategory, { ...item, thngNm: item.budgetCategory, thngCd: CATEGORY_ROOT_CODE, parentId: undefined, spec: '', unitPrice: 0, subtotal: 0 });
      }
    } else {
      others.push({ ...item });
    }
  }
  for (const category of CATEGORIES) {
    if (!roots.has(category)) roots.set(category, makeCategoryRow(category));
  }
  const otherIds = new Set(others.map(item => item.id));

  // 부모가 다른 품목이면 그대로(3단계), 아니면 해당 과목 루트의 자식(2단계)으로 붙인다.
  for (const item of others) {
    const underItem = !!item.parentId && otherIds.has(item.parentId);
    if (!underItem) item.parentId = roots.get(item.budgetCategory)!.id;
  }

  const childrenByParent = new Map<string, BudgetItem[]>();
  for (const item of others) {
    const list = childrenByParent.get(item.parentId!) ?? [];
    list.push(item);
    childrenByParent.set(item.parentId!, list);
  }
  // 자동 채움(0원 맞추기) 품목은 같은 부모 안에서 뒤로 보낸다.
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => (a.memo === AUTO_BALANCE_MEMO ? 1 : 0) - (b.memo === AUTO_BALANCE_MEMO ? 1 : 0));
  }

  const result: BudgetItem[] = [];
  for (const category of CATEGORIES) {
    const root = roots.get(category)!;
    root.budgetCategory = category;
    root.subtotal = 0;
    result.push(root);
    const walk = (parentId: string) => {
      for (const child of childrenByParent.get(parentId) ?? []) {
        child.budgetCategory = category;
        child.subtotal = childrenByParent.has(child.id) ? 0 : calcSubtotal(child);
        result.push(child);
        walk(child.id);
      }
    };
    walk(root.id);
  }
  return result;
}

function sortItemsByCategory(items: BudgetItem[]): BudgetItem[] {
  return normalizeToCategoryTree(items);
}

function normalizeBudgetItem(item: BudgetItem): BudgetItem | null {
  const budgetCategory = normalizeBudgetCategory(item.budgetCategory);
  if (!budgetCategory) return null;
  const quantity = normalizeQuantity(item.quantity, item.minQuantity, item.maxQuantity);
  const unitPrice = Math.max(0, item.unitPrice || 0);
  return {
    ...item,
    budgetCategory,
    quantity,
    unitPrice,
    subtotal: unitPrice * quantity,
  };
}

function normalizeBudgetPlan(plan: BudgetPlan): BudgetPlan {
  return {
    ...plan,
    items: sortItemsByCategory((plan.items ?? []).map(normalizeBudgetItem).filter((item): item is BudgetItem => !!item)),
  };
}

function formatSavedAt(value?: number): string {
  if (!value) return '';
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 생성된 품목들을 과목별 카테고리 루트 아래(2단계)로 정리한다. (별도 '세부' 단계 없음)
function groupGeneratedBudgetItems(items: BudgetItem[]): BudgetItem[] {
  return normalizeToCategoryTree(items);
}

function filterItemsByTitleIntent(items: BudgetItem[], title: string): BudgetItem[] {
  const titleKeywords = getTitleKeywords(title);
  const intentWords = Array.from(new Set(Object.values(titleKeywords).flat()))
    .map(word => word.replace(/\s/g, ''))
    .filter(word => word.length >= 2);
  if (intentWords.length === 0) return items;
  const matched = items.filter(item => {
    const text = `${item.thngNm} ${item.spec ?? ''}`.replace(/\s/g, '');
    return intentWords.some(word => text.includes(word) || word.includes(text));
  });
  return matched.length > 0 ? matched : items;
}

function filterItemsByDesiredIntent(items: BudgetItem[], keywordMap: Record<BudgetCategory, string>): BudgetItem[] {
  return CATEGORIES.flatMap(category => {
    const desiredWords = expandDesiredWords(splitDesiredItems(keywordMap[category]))
      .map(word => word.replace(/\s/g, ''))
      .filter(word => word.length >= 2);
    const categoryItems = items.filter(item => item.budgetCategory === category);
    if (desiredWords.length === 0) return categoryItems;
    const matched = categoryItems.filter(item => {
      const text = `${item.thngNm} ${item.spec ?? ''}`.replace(/\s/g, '');
      return desiredWords.some(word => text.includes(word) || word.includes(text));
    });
    return matched.length > 0 ? matched : categoryItems;
  });
}

function parseAiBudgetItems(text: string): Array<{ budgetCategory: BudgetCategory; thngNm: string; spec?: string; unitPrice: number; quantity: number }> {
  const parsed = parseJsonArrayFromAiText(text);
  return parsed
    .map((row: any) => ({
      budgetCategory: normalizeBudgetCategory(row.budgetCategory),
      thngNm: String(row.thngNm ?? '').trim(),
      spec: String(row.spec ?? '').trim(),
      unitPrice: Math.max(0, Math.round(Number(row.unitPrice) || 0)),
      quantity: Math.max(1, Math.round(Number(row.quantity) || 1)),
    }))
    .filter((item): item is { budgetCategory: BudgetCategory; thngNm: string; spec: string; unitPrice: number; quantity: number } =>
      !!item.budgetCategory && item.thngNm && item.unitPrice > 0 && !isExcludedAutoItemName(item.thngNm));
}

function buildLocalCandidates(title: string, keywordMap: Record<BudgetCategory, string>): Record<BudgetCategory, NaraItem[]> {
  const candidates: Record<BudgetCategory, NaraItem[]> = {
    교육운영비: [],
    일반운영비: [],
    업무추진비: [],
  };
  const titleText = title.replace(/\s/g, '');
  const titleKeywords = getTitleKeywords(title);
  for (const [hint, additions] of Object.entries(TITLE_DIRECT_ITEMS)) {
    if (!titleText.includes(hint)) continue;
    for (const category of CATEGORIES) {
      candidates[category] = [
        ...(additions[category] ?? []),
        ...candidates[category],
      ];
    }
  }
  for (const [hint, additions] of Object.entries(TITLE_HINTS)) {
    if (!titleText.includes(hint)) continue;
    for (const category of CATEGORIES) {
      const words = additions[category] ?? [];
      candidates[category] = [
        ...LOCAL_CATALOG[category].filter(item => words.some(word => item.thngNm.includes(word) || item.spec?.includes(word))),
        ...candidates[category],
      ];
    }
  }
  for (const category of CATEGORIES) {
    const explicitWords = splitDesiredItems(keywordMap[category]);
    const words = Array.from(new Set([...expandDesiredWords(explicitWords), ...(explicitWords.length > 0 ? [] : (titleKeywords[category] ?? []))]));
    const desiredItems = words.map(word => {
      const matched = LOCAL_CATALOG[category].find(item => item.thngNm.includes(word) || item.spec?.includes(word));
      return matched
        ? { ...matched, preferred: true }
        : { thngNm: word, thngCd: `desired-${category}-${word}`, spec: '직접 입력', unitPrice: estimateUnitPrice(category, word), preferred: true };
    });
    const matchedCatalog = LOCAL_CATALOG[category].filter(item => words.some(word => item.thngNm.includes(word) || item.spec?.includes(word)));
    // 제목·희망물품으로 잡힌 품목이 하나라도 있으면, 제목과 무관한 일반 카탈로그 전체를 덧붙이지 않는다.
    // (아무것도 안 잡힐 때만 일반 카탈로그를 후보로 사용한다.)
    const hasSpecific = desiredItems.length > 0 || matchedCatalog.length > 0 || candidates[category].length > 0;
    candidates[category] = [
      ...desiredItems,
      ...matchedCatalog,
      ...candidates[category],
      ...(hasSpecific ? [] : LOCAL_CATALOG[category]),
    ];
  }
  return candidates;
}

function balanceItemsByCategory(items: BudgetItem[], allocations: Record<BudgetCategory, number>): BudgetItem[] {
  const userItems: BudgetItem[] = items
    .filter(item => item.memo !== AUTO_BALANCE_MEMO)
    .map(item => {
      const originalQuantity = item.quantity;
      const quantity = normalizeQuantity(item.quantity, item.minQuantity, item.maxQuantity);
      const unitPrice = Math.max(0, item.unitPrice || 0);
      return { ...item, quantity, unitPrice, subtotal: unitPrice * quantity, quantityAdjusted: quantity !== originalQuantity };
    });
  const parentIds = parentIdsWithChildren(userItems);

  for (const category of CATEGORIES) {
    let used = userItems
      .filter(item => item.budgetCategory === category && !parentIds.has(item.id))
      .reduce((sum, item) => sum + item.subtotal, 0);

    const categoryItems = userItems
      .filter(item => item.budgetCategory === category && !parentIds.has(item.id) && item.unitPrice > 0 && !item.quantityLocked && !item.unitPriceLocked)
      .sort((a, b) => a.unitPrice - b.unitPrice);

    for (let step = 0; step < 200; step += 1) {
      const currentGap = Math.abs(allocations[category] - used);
      let bestItem: BudgetItem | null = null;
      let bestDelta = 0;
      let bestGap = currentGap;

      for (const item of categoryItems) {
        const minQuantity = Math.max(1, item.minQuantity || 1);
        const maxQuantity = item.maxQuantity && item.maxQuantity >= minQuantity ? item.maxQuantity : undefined;
        const diff = allocations[category] - used;
        const maxAdd = maxQuantity ? Math.max(0, maxQuantity - item.quantity) : 9999;
        const maxRemove = Math.max(0, item.quantity - minQuantity);
        const deltaCandidates = new Set<number>();

        if (maxAdd > 0) {
          deltaCandidates.add(1);
          if (diff > 0) {
            deltaCandidates.add(Math.min(maxAdd, Math.max(1, Math.floor(diff / item.unitPrice))));
            deltaCandidates.add(Math.min(maxAdd, Math.max(1, Math.ceil(diff / item.unitPrice))));
          }
        }
        if (maxRemove > 0) {
          deltaCandidates.add(-1);
          if (diff < 0) {
            const over = Math.abs(diff);
            deltaCandidates.add(-Math.min(maxRemove, Math.max(1, Math.floor(over / item.unitPrice))));
            deltaCandidates.add(-Math.min(maxRemove, Math.max(1, Math.ceil(over / item.unitPrice))));
          }
        }

        for (const delta of deltaCandidates) {
          if (delta === 0 || delta > maxAdd || Math.abs(Math.min(0, delta)) > maxRemove) continue;
          const nextGap = Math.abs(allocations[category] - (used + delta * item.unitPrice));
          if (nextGap < bestGap) {
            bestGap = nextGap;
            bestItem = item;
            bestDelta = delta;
          }
        }
      }

      if (bestItem && bestDelta !== 0) {
        bestItem.quantity += bestDelta;
        bestItem.subtotal = calcSubtotal(bestItem);
        bestItem.quantityAdjusted = true;
        used += bestDelta * bestItem.unitPrice;
      } else {
        break;
      }
    }

    const finalGap = allocations[category] - used;
    const hasCategoryItem = userItems.some(item => item.budgetCategory === category);
    if (hasCategoryItem && finalGap > 0) {
      const balanceItems = pickSmallBalanceItems(category, finalGap);
      if (balanceItems.length > 0) {
        userItems.push(...balanceItems);
      }
    }
  }
  return sortItemsByCategory(userItems);
}

function pickFillCategory(leaves: BudgetItem[]): BudgetCategory {
  const used: Record<BudgetCategory, number> = { 교육운영비: 0, 일반운영비: 0, 업무추진비: 0 };
  for (const item of leaves) used[item.budgetCategory] += item.subtotal;
  let bestCategory: BudgetCategory = '교육운영비';
  for (const category of CATEGORIES) {
    if (used[category] > used[bestCategory]) bestCategory = category;
  }
  return bestCategory;
}

// '0원 맞추기' 본체.
// - 사용자가 직접 수정/잠근 행은 그대로 고정한다.
// - 나머지 행은 현재 수량을 최대한 유지(변경 최소화)하면서, 단가가 큰 품목 위주로 수량을 최소한만
//   조정해 전체 예산 총액의 잔액을 0원에 가깝게 맞춘다.
// - 품목에 최소·최대 수량이 지정돼 있으면 그 범위 안에서만 조정한다.
// - 남는 끝자리 금액은 소액 품목으로 채워 0에 최대한 근접시킨다.
function solveZeroBalance(items: BudgetItem[], totalBudget: number): { items: BudgetItem[]; remaining: number } {
  const working = items
    .filter(item => item.memo !== AUTO_BALANCE_MEMO) // 이전 자동 채움 항목 제거 후 다시 계산
    .map(item => ({ ...item }));

  const leaves = () => {
    const pIds = parentIdsWithChildren(working);
    return working.filter(item => !pIds.has(item.id));
  };
  const usedTotal = () => leaves().reduce((sum, item) => sum + calcSubtotal(item), 0);

  const adjustable = leaves()
    .filter(item => !item.quantityLocked && !item.unitPriceLocked && item.unitPrice > 0)
    .map(item => {
      const lo = Math.max(1, item.minQuantity || 1);
      const hi = item.maxQuantity && item.maxQuantity >= lo ? item.maxQuantity : Number.MAX_SAFE_INTEGER;
      return { item, lo, hi };
    });

  // 단가가 큰 품목부터 조정해 바꾸는 수량(횟수)을 최소화한다.
  const byPriceDesc = [...adjustable].sort((a, b) => b.item.unitPrice - a.item.unitPrice);
  const setQuantity = (entry: { item: BudgetItem }, quantity: number) => {
    entry.item.quantity = quantity;
    entry.item.subtotal = calcSubtotal(entry.item);
    entry.item.quantityAdjusted = true;
  };

  let gap = totalBudget - usedTotal(); // >0 더 써야 함, <0 예산 초과

  // 부족분: 단가가 큰 품목부터 최대 수량 한도 내에서 추가
  if (gap > 0) {
    for (const entry of byPriceDesc) {
      if (gap <= 0) break;
      const addable = entry.hi - entry.item.quantity;
      const add = Math.min(addable, Math.floor(gap / entry.item.unitPrice));
      if (add <= 0) continue;
      setQuantity(entry, entry.item.quantity + add);
      gap -= add * entry.item.unitPrice;
    }
  }

  // 초과분: 단가가 큰 품목부터 최소 수량 한도 내에서 감소
  if (gap < 0) {
    for (const entry of byPriceDesc) {
      if (gap >= 0) break;
      const removable = entry.item.quantity - entry.lo;
      const remove = Math.min(removable, Math.floor(-gap / entry.item.unitPrice));
      if (remove <= 0) continue;
      setQuantity(entry, entry.item.quantity - remove);
      gap += remove * entry.item.unitPrice;
    }
    // 아직 미세하게 초과면, 가장 싼 품목 1개를 더 줄여 잔액을 0 이상으로 돌린 뒤 소액 품목으로 채운다.
    if (gap < 0) {
      const cheapest = [...adjustable]
        .filter(entry => entry.item.quantity - entry.lo > 0)
        .sort((a, b) => a.item.unitPrice - b.item.unitPrice)[0];
      if (cheapest) {
        setQuantity(cheapest, cheapest.item.quantity - 1);
        gap += cheapest.item.unitPrice;
      }
    }
  }

  // 남은 부족분을 소액 품목으로 채운다.
  let remaining = totalBudget - usedTotal();
  if (remaining > 0) {
    const fillItems = pickSmallBalanceItems(pickFillCategory(leaves()), remaining);
    if (fillItems.length > 0) working.push(...fillItems);
    remaining = totalBudget - usedTotal();
  }

  return { items: sortItemsByCategory(working), remaining };
}

export default function BudgetPlannerScreen() {
  const { startTour } = useTour();
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [activePlan, setActivePlan] = useState<BudgetPlan | null>(null);
  const [totalBudget, setTotalBudget] = useState('');
  const [planTitle, setPlanTitle] = useState('');

  // 나라장터 인증키 원문은 앱에서 다시 받아오지 않는다. 입력칸 값과 저장 여부만 관리한다.
  const [apiKey, setApiKey] = useState('');
  const [hasSavedNaramarketKey, setHasSavedNaramarketKey] = useState(false);
  const [showPriceSettings, setShowPriceSettings] = useState(false);
  const [showApiGuide, setShowApiGuide] = useState(false);
  const [showBalanceHelp, setShowBalanceHelp] = useState(false);
  const [apiGuideStep, setApiGuideStep] = useState(1);
  const [naramarketTestMessage, setNaramarketTestMessage] = useState('');
  const [isTestingNaramarket, setIsTestingNaramarket] = useState(false);

  const [ratioEdu, setRatioEdu] = useState('75');
  const [ratioGeneral, setRatioGeneral] = useState('20');
  const [ratioBiz, setRatioBiz] = useState('5');
  const [keywordEdu, setKeywordEdu] = useState('');
  const [keywordGeneral, setKeywordGeneral] = useState('');
  const [keywordBiz, setKeywordBiz] = useState('');
  const [keywordFree, setKeywordFree] = useState('');

  const [useCategoryRatio, setUseCategoryRatio] = useState(true);
  const [showRatio, setShowRatio] = useState(true);
  const [recommendationStatus, setRecommendationStatus] = useState<RecommendationStatus>('idle');
  const [recommendationMessage, setRecommendationMessage] = useState('');
  const [collapsedBudgetIds, setCollapsedBudgetIds] = useState<Set<string>>(new Set());
  const [inputSidebarCollapsed, setInputSidebarCollapsed] = useState(false);

  // 품목 검색 패널 상태
  const [priceSearchQuery, setPriceSearchQuery] = useState('');
  const [priceSearchCategory, setPriceSearchCategory] = useState<BudgetCategory>('교육운영비');
  const [priceSearchResults, setPriceSearchResults] = useState<NaraItem[]>([]);
  const [priceSearchStatus, setPriceSearchStatus] = useState<RecommendationStatus>('idle');
  const [priceSearchMessage, setPriceSearchMessage] = useState('');
  const [priceSearchPage, setPriceSearchPage] = useState(1);
  const [priceSearchHasMore, setPriceSearchHasMore] = useState(false);
  // 나라장터에 없는 시중 물품은 AI 웹 검색으로 참고 단가를 조사한다(선택).
  const [useMarketPriceSearch, setUseMarketPriceSearch] = useState(false);
  const [previewImages, setPreviewImages] = useState<Record<string, string>>({}); // 이미지 URL → data URI 캐시

  useEffect(() => {
    window.electronAPI.hasNaramarketKey().then(saved => {
      setHasSavedNaramarketKey(!!saved);
    }).catch(() => {});
    Promise.all([
      window.electronAPI.readJsonData('budget-plans').catch(() => []),
      window.electronAPI.readJsonData(BUDGET_PLANNER_STATE_KEY).catch(() => null),
    ]).then(([planData, savedState]) => {
      if (!Array.isArray(planData)) return;
      const normalizedPlans = (planData as BudgetPlan[]).map(normalizeBudgetPlan);
      setPlans(normalizedPlans);
      const state = (savedState && typeof savedState === 'object') ? savedState as BudgetPlannerState : null;
      const savedActivePlan = normalizedPlans.find(plan => plan.id === state?.activePlanId)
        ?? [...normalizedPlans].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))[0];
      if (savedActivePlan) setActivePlan(savedActivePlan);
      if (state?.planTitle || savedActivePlan) setPlanTitle(state?.planTitle ?? savedActivePlan.title);
      if (state?.totalBudget || savedActivePlan) setTotalBudget(state?.totalBudget ?? fmt(savedActivePlan.totalBudget));
      if (typeof state?.useCategoryRatio === 'boolean') setUseCategoryRatio(state.useCategoryRatio);
      if (state?.ratioEdu) setRatioEdu(state.ratioEdu);
      if (state?.ratioGeneral) setRatioGeneral(state.ratioGeneral);
      if (state?.ratioBiz) setRatioBiz(state.ratioBiz);
      if (state?.keywordEdu) setKeywordEdu(state.keywordEdu);
      if (state?.keywordGeneral) setKeywordGeneral(state.keywordGeneral);
      if (state?.keywordBiz) setKeywordBiz(state.keywordBiz);
      if (state?.keywordFree) setKeywordFree(state.keywordFree);
    }).catch(() => {});
  }, []);

  const ratioTotal = (parseInt(ratioEdu) || 0) + (parseInt(ratioGeneral) || 0) + (parseInt(ratioBiz) || 0);
  const budgetForCalc = activePlan?.totalBudget ?? parseMoney(totalBudget);
  const computeAllocations = (budget: number): Record<BudgetCategory, number> => {
    if (!useCategoryRatio) return { 교육운영비: budget, 일반운영비: 0, 업무추진비: 0 };
    // 비율을 입력하지 않았을 때는 업무추진비를 총 예산의 3%로 두고, 나머지를 교육운영비·일반운영비에 배분한다.
    if (ratioTotal <= 0) {
      const biz = Math.round(budget * 0.03);
      const edu = Math.round(budget * 0.77);
      const general = Math.max(0, budget - edu - biz);
      return { 교육운영비: edu, 일반운영비: general, 업무추진비: biz };
    }
    const edu = Math.round(budget * (parseInt(ratioEdu) || 0) / ratioTotal);
    const general = Math.round(budget * (parseInt(ratioGeneral) || 0) / ratioTotal);
    const biz = Math.max(0, budget - edu - general);
    return { 교육운영비: edu, 일반운영비: general, 업무추진비: biz };
  };
  const allocations: Record<BudgetCategory, number> = computeAllocations(budgetForCalc);

  const countablePlanItems = useMemo(() => countableItems(activePlan?.items ?? []), [activePlan]);
  const planTotalUsed = countablePlanItems.reduce((sum, item) => sum + item.subtotal, 0);
  const planRemaining = (activePlan?.totalBudget ?? 0) - planTotalUsed;
  const examplePreviewItems = useMemo(() => buildExampleBudgetItems(), []);
  const examplePreviewTotal = countableItems(examplePreviewItems).reduce((sum, item) => sum + item.subtotal, 0);
  const examplePreviewBudget = parseMoney(DEFAULT_BUDGET_TOTAL);

  const usedByCategory = useMemo(() => {
    const used: Record<BudgetCategory, number> = { 교육운영비: 0, 일반운영비: 0, 업무추진비: 0 };
    for (const item of countableItems(activePlan?.items ?? [])) used[item.budgetCategory] += item.subtotal;
    return used;
  }, [activePlan]);

  const keywordMap: Record<BudgetCategory, string> = {
    교육운영비: useCategoryRatio ? keywordEdu : keywordFree,
    일반운영비: useCategoryRatio ? keywordGeneral : '',
    업무추진비: useCategoryRatio ? keywordBiz : '',
  };

  const setKeywordMap: Record<BudgetCategory, React.Dispatch<React.SetStateAction<string>>> = {
    교육운영비: setKeywordEdu,
    일반운영비: setKeywordGeneral,
    업무추진비: setKeywordBiz,
  };

  const savePlans = async (updated: BudgetPlan[]) => {
    setPlans(updated);
    await window.electronAPI.writeJsonData('budget-plans', updated);
  };

  const savePlannerState = async (activePlanId?: string) => {
    const state: BudgetPlannerState = {
      activePlanId,
      totalBudget,
      planTitle,
      useCategoryRatio,
      ratioEdu,
      ratioGeneral,
      ratioBiz,
      keywordEdu,
      keywordGeneral,
      keywordBiz,
      keywordFree,
    };
    await window.electronAPI.writeJsonData(BUDGET_PLANNER_STATE_KEY, state);
  };

  const saveApiKey = async () => {
    const trimmedKey = apiKey.trim();
    setApiKey(trimmedKey);
    // 인증키 입력칸이 비어 있으면 저장된 기존 값을 지우지 않도록 아무것도 보내지 않는다.
    if (!trimmedKey) return;
    await window.electronAPI.setConfig({ naramarketApiKey: trimmedKey });
    setHasSavedNaramarketKey(true);
  };

  // 저장한 인증키가 실제로 통하는지 고정 검색어로 한 번 확인한다.
  // 실패하면 포털이 알려준 사유(등록되지 않은 서비스키·활용신청 미승인 등)를 그대로 보여준다.
  const testNaramarketKey = async () => {
    if (!apiKey.trim() && !hasSavedNaramarketKey) {
      setNaramarketTestMessage('먼저 인증키를 입력해주세요.');
      return;
    }
    setIsTestingNaramarket(true);
    setNaramarketTestMessage('');
    try {
      await saveApiKey();
      const data = await window.electronAPI.naramarketShoppingSearch('복사용지');
      // "결과 없음"에는 원인이 둘 있다. 정말 0건인 경우와, 항목은 왔는데 단가 필드를
      // 읽지 못해 전부 걸러진 경우다. 둘을 구분해야 다음에 무엇을 고칠지 알 수 있다.
      const received = readApiItemCount(data);
      const priced = normalizeApiItems(data, true).filter(item => (item.unitPrice ?? 0) > 0);
      if (priced.length > 0) {
        // 응답 항목 이름을 함께 남긴다 — 썸네일·식별번호처럼 새 항목을 붙일 때
        // 어떤 필드를 읽어야 하는지 앱에서 바로 확인할 수 있다.
        // 숫자로만 된 값은 이름=값으로 함께 보여준다. 물품식별번호(8자리)와
        // 물품분류번호(10자리)는 이름만으로 구분되지 않고 자릿수를 봐야 알 수 있다.
        const numeric = readNumericFieldSamples(data);
        setNaramarketTestMessage(
          `연결됨 · 복사용지 ${priced.length}건 확인 · 응답 항목: ${received.fieldNames}`
          + (numeric ? ` · 숫자 항목: ${numeric}` : ''),
        );
      } else if (received.count > 0) {
        setNaramarketTestMessage(
          `${received.count}건을 받았지만 단가를 읽지 못했습니다. 응답 항목: ${received.fieldNames}`,
        );
      } else {
        setNaramarketTestMessage('연결은 되었지만 복사용지 검색 결과가 0건입니다. 다른 검색어로 다시 확인해주세요.');
      }
    } catch (e: any) {
      setNaramarketTestMessage(e?.message ?? '나라장터 조회 중 오류가 발생했습니다.');
    } finally {
      setIsTestingNaramarket(false);
    }
  };

  const handleNewPlan = async () => {
    const budget = parseMoney(totalBudget);
    const title = planTitle.trim();
    if (!title || budget <= 0) return;
    const desiredItems = { ...keywordMap };
    const alloc = computeAllocations(budget);
    const isDefaultExample = useCategoryRatio && title === DEFAULT_BUDGET_TITLE && budget === parseMoney(DEFAULT_BUDGET_TOTAL);
    const newPlan: BudgetPlan = {
      id: genId(),
      title,
      totalBudget: budget,
      items: isDefaultExample ? buildExampleBudgetItems() : normalizeToCategoryTree([]),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setActivePlan(newPlan);

    // 기본 예시 값 그대로면 예시 예산안을 그대로 편집하도록 두고, 그 외에는 곧바로 AI 품목 생성을 진행한다.
    if (isDefaultExample) {
      setRecommendationStatus('idle');
      setRecommendationMessage('');
      return;
    }

    setRecommendationStatus('loading');
    setRecommendationMessage('');
    try {
      const { items: next, source } = await makeRecommendations(title, budget, alloc, desiredItems);
      const grouped = useCategoryRatio ? groupGeneratedBudgetItems(next) : next.map(item => ({ ...item, parentId: undefined }));
      setActivePlan({ ...newPlan, items: grouped, updatedAt: Date.now() });
      setRecommendationStatus('ready');
      setRecommendationMessage(source === 'ai'
        ? `Gemini가 예산안 ${grouped.length}개 행을 만들었습니다.`
        : `Gemini 호출이 어려워 내장 후보로 예산안 ${grouped.length}개 행을 만들었습니다.`);
      playSuccessSound();
    } catch (e: any) {
      setRecommendationStatus('error');
      setRecommendationMessage(e?.message ?? '예산안을 만들지 못했습니다.');
    }
  };

  const updatePlanItems = (items: BudgetItem[]) => {
    if (!activePlan) return;
    setActivePlan({ ...activePlan, items, updatedAt: Date.now() });
  };

  const revealCategory = (items: BudgetItem[], category: BudgetCategory) => {
    const rootId = items.find(item => isCategoryRow(item) && item.budgetCategory === category)?.id;
    if (rootId) setCollapsedBudgetIds(prev => { const next = new Set(prev); next.delete(rootId); return next; });
  };

  // 같은 과목끼리 묶어 카테고리 트리로 다시 정렬한다.
  const handleSortByCategory = () => {
    if (!activePlan) return;
    updatePlanItems(normalizeToCategoryTree(activePlan.items));
  };

  // 트리를 모두 접거나(과목 3줄만) 모두 펼친다.
  const toggleCollapseAll = () => {
    if (!activePlan) return;
    setCollapsedBudgetIds(prev => (prev.size > 0 ? new Set() : parentIdsWithChildren(activePlan.items)));
  };

  // 품목 검색: 나라장터 종합쇼핑몰에서 실제 계약 품목과 단가를 페이지 단위로 가져온다.
  // '더 보기'를 누르면 다음 페이지를 이어서 보여준다.
  const runPriceSearch = async (page: number, append: boolean) => {
    const query = priceSearchQuery.trim();
    if (!query) return;
    const hasNaraKey = !!apiKey.trim() || hasSavedNaramarketKey;
    if (!hasNaraKey && !useMarketPriceSearch) {
      setPriceSearchStatus('error');
      setPriceSearchMessage('먼저 나라장터 인증키를 저장하거나, 웹 검색 참고가 조사를 켜주세요.');
      return;
    }
    setPriceSearchStatus('loading');
    if (!append) { setPriceSearchResults([]); setPriceSearchMessage(''); setPriceSearchHasMore(false); }

    const fetched: NaraItem[] = [];
    const failures: string[] = [];
    let naraCount = 0;

    if (hasNaraKey) {
      try {
        const data = await window.electronAPI.naramarketShoppingSearch(query, page);
        const naraItems = normalizeApiItems(data, true)
          .filter(item => (item.unitPrice ?? 0) > 0)
          .map(item => ({ ...item, priceSource: '나라장터' }));
        naraCount = naraItems.length;
        fetched.push(...naraItems);
      } catch (e: any) {
        // 메인 프로세스가 이미 '나라장터 API 오류: ...' 형태로 사유를 담아 보낸다.
        failures.push(e?.message ?? '나라장터 조회에 실패했습니다.');
      }
    }

    // 웹 검색 참고가는 첫 페이지에서만 조사한다(검색 건수만큼 요금이 발생하므로).
    if (useMarketPriceSearch && !append) {
      try {
        fetched.push(...await fetchMarketPriceItems(query));
      } catch (e: any) {
        failures.push(`웹 검색 참고가 조사 실패: ${e?.message ?? '알 수 없는 오류'}`);
      }
    }

    let totalShown = 0;
    setPriceSearchResults(prev => {
      const merged = uniqueSearchItems(append ? [...prev, ...fetched] : fetched);
      totalShown = merged.length;
      return merged;
    });
    // 나라장터가 이번 페이지를 가득 채워 돌려줬으면 다음 페이지가 더 있을 수 있다.
    const hasMore = hasNaraKey && naraCount > 0 && page < 20;
    setPriceSearchHasMore(hasMore);
    setPriceSearchPage(page);
    setPriceSearchStatus(totalShown > 0 ? 'ready' : 'error');
    setPriceSearchMessage(totalShown > 0
      ? `${totalShown}건 표시 중${hasMore ? ' · 더 보기로 다음 결과를 이어서 볼 수 있습니다.' : ''}`
      : failures[0] ?? '검색 결과가 없습니다. 다른 키워드로 시도하거나 「직접 검색하기」로 확인해보세요.');
  };

  // AI 웹 검색으로 시중 참고 단가를 조사해 검색 결과 목록에 넣을 형태로 바꾼다.
  const fetchMarketPriceItems = async (query: string): Promise<NaraItem[]> => {
    const { text } = await window.electronAPI.aiGenerate(
      buildMarketPriceSearchPrompt(query),
      MARKET_PRICE_SYSTEM_INSTRUCTION,
      { temperature: 0.2, useSearchGrounding: true },
    );
    return parseMarketPriceItems(text).map(item => ({
      thngNm: item.name,
      thngCd: `market-${item.name}-${item.unitPrice}`,
      spec: item.spec,
      mnfctCorpNm: item.maker,
      unitPrice: item.unitPrice,
      priceSource: MARKET_PRICE_SOURCE_LABEL,
      priceSourceUrl: item.sourceUrl,
    }));
  };

  const handlePriceSearch = () => runPriceSearch(1, false);
  const handlePriceSearchMore = () => runPriceSearch(priceSearchPage + 1, true);

  const addSearchItemToPlan = (item: NaraItem) => {
    if (!activePlan) return;
    // 예산안에는 "물품명(식별번호)"로 넣어, 나중에 나라장터에서 같은 물품을 바로 찾을 수 있게 한다.
    const named: NaraItem = { ...item, thngNm: formatItemNameWithIdNo(item.thngNm, item.thngCd) };
    // 검색으로 추가한 품목은 해당 과목의 맨 위에 들어가도록 배열 앞쪽에 넣어 정규화한다.
    const next = useCategoryRatio
      ? normalizeToCategoryTree([makeItem(priceSearchCategory, named), ...activePlan.items])
      : [makeItem('교육운영비', named), ...activePlan.items.filter(row => !isCategoryRow(row))];
    updatePlanItems(next);
    if (useCategoryRatio) revealCategory(next, priceSearchCategory);
    setPriceSearchMessage(useCategoryRatio
      ? `'${named.thngNm}'을(를) ${priceSearchCategory} 맨 위에 추가했습니다.`
      : `'${named.thngNm}'을(를) 맨 위에 추가했습니다.`);
  };

  // 입력한 키워드로 쇼핑 검색 결과 창을 연다. 창을 띄우지 못하면 조용히 넘어가지 않고 알린다.
  const openDirectPriceSearch = async () => {
    const query = priceSearchQuery.trim();
    if (!query) return;
    try {
      const opened = await window.electronAPI.openPriceSearchWindow(query);
      if (!opened) {
        setPriceSearchStatus('error');
        setPriceSearchMessage('검색 창을 열지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch (e: any) {
      setPriceSearchStatus('error');
      setPriceSearchMessage(e?.message ?? '검색 창을 열지 못했습니다.');
    }
  };

  // 검색 결과의 출처 링크를 기본 브라우저로 연다. 열지 못하면 원인을 화면에 남긴다.
  const openSourceLink = async (url: string) => {
    try {
      const opened = await window.electronAPI.openExternal(url);
      if (opened === false) {
        setPriceSearchStatus('error');
        setPriceSearchMessage('출처 주소를 열지 못했습니다. 주소가 올바르지 않을 수 있습니다.');
      }
    } catch {
      setPriceSearchStatus('error');
      setPriceSearchMessage('출처 주소를 열지 못했습니다.');
    }
  };

  // 상품 이미지를 data URI로 받아 썸네일로 보여준다(렌더러 CSP 때문에 메인 프로세스가 대신 받아온다).
  // 같은 주소를 여러 번 요청하지 않도록, 아직 응답이 오지 않은 주소는 ref에 기록해 둔다 —
  // 목록 여러 줄이 같은 순간에 요청하면 previewImages 상태는 아직 비어 있어 중복 요청이 나간다.
  const requestedImagesRef = useRef<Set<string>>(new Set());
  const loadPreviewImage = (url?: string) => {
    if (!url || requestedImagesRef.current.has(url)) return;
    requestedImagesRef.current.add(url);
    window.electronAPI.fetchImage(url)
      .then(dataUri => setPreviewImages(prev => ({ ...prev, [url]: dataUri || '' })))
      .catch(() => setPreviewImages(prev => ({ ...prev, [url]: '' })));
  };

  // 검색 결과가 나오면 사진을 바로 받아 썸네일로 보여준다(마우스를 올릴 때까지 기다리지 않는다).
  useEffect(() => {
    priceSearchResults.forEach(item => loadPreviewImage(item.image));
  }, [priceSearchResults]);

  // 품목 검색에 쓸 수 있는 나라장터 키가 저장돼 있는지 여부
  const hasPriceLookupKey = !!apiKey.trim() || hasSavedNaramarketKey;
  const priceSearchTooltip = hasPriceLookupKey || useMarketPriceSearch
    ? '키워드로 실제 품목과 단가를 조회합니다.'
    : '먼저 왼쪽 \'가격 조회 정보 선택 입력\'에서 나라장터 인증키를 저장하거나, 아래 웹 검색 참고가 조사를 켜주세요.';

  const addChildItemToPlan = (parentId: string) => {
    if (!activePlan) return;
    const parent = activePlan.items.find(item => item.id === parentId);
    if (!parent) return;
    const parentDepth = getItemDepth(activePlan.items, parent);
    if (parentDepth >= MAX_BUDGET_DEPTH) return;
    const child = makeItem(parent.budgetCategory, { thngNm: '', spec: parentDepth === 1 ? '' : '직접 입력' });
    child.parentId = parentId;
    const parentIndex = activePlan.items.findIndex(item => item.id === parentId);
    const insertAt = parentIndex >= 0 ? parentIndex + 1 : activePlan.items.length;
    setCollapsedBudgetIds(prev => {
      const next = new Set(prev);
      next.delete(parentId);
      return next;
    });
    updatePlanItems([
      ...activePlan.items.slice(0, insertAt),
      child,
      ...activePlan.items.slice(insertAt),
    ]);
  };

  const updateRows = (
    rows: BudgetItem[],
    id: string,
    patch: Partial<Pick<BudgetItem, 'budgetCategory' | 'thngNm' | 'unitPrice' | 'quantity' | 'minQuantity' | 'maxQuantity' | 'spec'>>,
  ): BudgetItem[] => rows.map(item => {
    const descendantIds = patch.budgetCategory ? collectDescendantIds(rows, id) : new Set<string>();
    if (descendantIds.has(item.id) && patch.budgetCategory) {
      return { ...item, budgetCategory: patch.budgetCategory };
    }
    if (item.id !== id) return item;
    const updated = {
      ...item,
      ...patch,
      quantityLocked: Object.prototype.hasOwnProperty.call(patch, 'quantity') ? true : item.quantityLocked,
      unitPriceLocked: Object.prototype.hasOwnProperty.call(patch, 'unitPrice') ? true : item.unitPriceLocked,
      quantityAdjusted: false,
    };
    updated.minQuantity = updated.minQuantity ? Math.max(1, updated.minQuantity) : undefined;
    updated.maxQuantity = updated.maxQuantity && updated.maxQuantity >= (updated.minQuantity ?? 1) ? updated.maxQuantity : undefined;
    updated.quantity = normalizeQuantity(updated.quantity, updated.minQuantity, updated.maxQuantity);
    updated.unitPrice = Math.max(0, updated.unitPrice || 0);
    updated.subtotal = calcSubtotal(updated);
    return updated;
  });

  const collectBudgetCandidates = async (
    title: string,
    desiredItems: Record<BudgetCategory, string>,
  ): Promise<Record<BudgetCategory, NaraItem[]>> => {
    const localCandidates = buildLocalCandidates(title, desiredItems);
    const titleKeywords = getTitleKeywords(title);
    const candidates: Record<BudgetCategory, NaraItem[]> = {
      교육운영비: [...localCandidates.교육운영비],
      일반운영비: [...localCandidates.일반운영비],
      업무추진비: [...localCandidates.업무추진비],
    };

    const hasNaraKey = !!apiKey.trim() || hasSavedNaramarketKey;
    if (!hasNaraKey) return candidates;
    for (const category of CATEGORIES) {
      const explicitWords = splitDesiredItems(desiredItems[category]);
      const keywords = Array.from(new Set([
        ...expandDesiredWords(explicitWords),
        ...(explicitWords.length > 0 ? [] : (titleKeywords[category] ?? [])),
      ])).slice(0, 6);
      for (const keyword of keywords) {
        try {
          const data = await window.electronAPI.naramarketShoppingSearch(keyword);
          candidates[category].unshift(...normalizeApiItems(data, true));
        } catch {
          // API 결과가 없어도 내장 후보로 예산안을 계속 만듭니다.
        }
      }
    }
    return candidates;
  };

  const makeAiBudgetPlan = async (
    candidates: Record<BudgetCategory, NaraItem[]>,
    title: string,
    budget: number,
    alloc: Record<BudgetCategory, number>,
    desiredItems: Record<BudgetCategory, string>,
  ): Promise<BudgetItem[]> => {
    const titleKeywords = getTitleKeywords(title);
    const candidateSummary = Object.fromEntries(CATEGORIES.map(category => [
      category,
      uniqueItems(candidates[category]).slice(0, 20).map(item => ({
        name: item.thngNm,
        spec: item.spec ?? '',
        unitPrice: item.unitPrice ?? 0,
      })),
    ]));
    const prompt = [
      '학교 예산사용계획 품목표를 만들어줘.',
      '반드시 JSON 배열만 응답해. 설명, 마크다운, 코드블록은 쓰지 마.',
      '각 항목 필드: budgetCategory, thngNm, spec, unitPrice, quantity',
      'budgetCategory는 교육운영비, 일반운영비, 업무추진비 중 하나만 사용해.',
      SCHOOL_ACCOUNTING_GUIDE,
      'unitPrice와 quantity는 양의 정수로 작성해.',
      '먼저 예산 제목에서 핵심 주제와 사업 목적을 분석해, 그 주제에 직접 어울리는 품목만 생성해.',
      '예산 제목과 구입 희망 물품의 성격을 분석해 어울리는 품목을 고르고, 과목별 배정액에 가깝게 맞춰.',
      '후보 품목 목록(candidateItems)은 단가 참고용일 뿐이다. 예산을 채우려고 제목 주제와 무관한 후보 품목을 그대로 넣지 마.',
      '강사비, 원고비, 수수료, 임차료, 홍보물, 현수막, 사무·운영성 라이선스는 일반운영비로 분류해.',
      '학생이 직접 쓰는 교육활동 물품, 학생 간식, 학생 기념품, 체험·행사 운영 물품은 교육운영비로 분류해.',
      '업무추진비는 협의회나 사업 추진을 위한 식비와 다과비처럼 업무추진 목적이 분명할 때만 사용해.',
      '과목별 배정액이 0보다 큰 모든 과목(교육운영비·일반운영비·업무추진비)에 가능한 한 예산 제목 주제와 연결된 품목을 넣어. 예: 주제가 "과학 탐구"면 교육운영비는 과학 실험 교구·재료, 일반운영비는 과학 수업용 인쇄·소모품·강사비, 업무추진비는 과학 행사 협의회 다과처럼 같은 주제로 연결해. 주제와 도저히 연결할 수 없을 때만 그 과목의 일반 운영성 품목을 써.',
      '상품권, 문화상품권, 기프트카드, 모바일 쿠폰, 기프티콘은 자동 생성하지 마. 학생 보상성 항목은 간식, 기념품, 체험 물품, 학습 활동 물품으로 대체해.',
      '예산 제목에 특정 품목이나 활동명이 있으면 그 품목·활동과 직접 관련된 품목만 사용해.',
      '예산 제목과 직접 관련 없는 기본 사무용품, 다과, 청소용품, 도서 등을 끼워 넣지 마.',
      '후보 품목이 있으면 후보 단가를 우선 사용하고, 예산이 남으면 주제에 맞는 품목의 수량을 늘리거나 같은 성격의 품목만 직접 제안해.',
      'unitPrice(단가)는 반드시 1,000원(천원) 단위로 맞춰. 예: 10,000원, 15,000원, 22,000원처럼 1,000원 배수여야 하며, 1,234원·3,500원처럼 천원 단위가 아닌 값은 절대 쓰지 마.',
      '전체 예산과 과목별 배정액을 초과하지 않는 방향으로 6~18개 행을 만들어.',
      '각 품목은 서로 다른 이름을 가져야 한다. 동일한 품목명을 절대 반복 사용하지 마. 예: "돌봄교실 학습 기자재"를 여러 행에 쓰는 것 금지. 같은 목적이라도 구체적으로 다른 품목명(블록완구, 퍼즐세트, 색연필세트, 보드게임 등)으로 분리해.',
      '사용자가 과목별로 입력한 구입 물품이 있으면 그 입력을 최우선으로 반영해.',
      '입력한 물품이 넓은 표현이면 같은 목적의 구체 품목으로만 확장해. 예: 에듀테크는 태블릿, 스마트기기, 코딩교구 / 다과와 식비는 간식, 음료, 도시락.',
      '입력한 물품과 무관한 기본 사무용품이나 다른 과목 물품을 예산 맞추기용으로 섞지 마.',
      JSON.stringify({
        title,
        totalBudget: budget,
        allocations: alloc,
        titleKeywords,
        desiredItems,
        excludedAutoItems: EXCLUDED_AUTO_ITEM_WORDS,
        candidateItems: candidateSummary,
      }, null, 2),
    ].join('\n');
    const systemInstruction = '너는 한국 학교 예산사용계획을 작성하는 행정 보조자다. 사용자가 바로 수정하고 CSV로 내려받을 수 있는 품목표만 만든다.';
    const { text } = await window.electronAPI.aiGenerate(prompt, systemInstruction, { temperature: 0.4, responseJson: true });
    const parsed = parseAiBudgetItems(text);
    if (parsed.length === 0) throw new Error('AI가 사용할 수 있는 예산안 품목을 만들지 못했습니다.');
    const aiItems = parsed.map(item => ({
      id: genId(),
      budgetCategory: item.budgetCategory,
      thngNm: item.thngNm,
      thngCd: 'ai-generated',
      spec: item.spec ?? '',
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.unitPrice * item.quantity,
    }));
    const desiredFilteredItems = filterItemsByDesiredIntent(aiItems, desiredItems);
    return Object.values(desiredItems).some(value => splitDesiredItems(value).length > 0)
      ? desiredFilteredItems
      : filterItemsByTitleIntent(desiredFilteredItems, title);
  };

  const makeRecommendations = async (
    title: string,
    budget: number,
    alloc: Record<BudgetCategory, number>,
    desiredItems: Record<BudgetCategory, string>,
  ): Promise<{ items: BudgetItem[]; source: 'ai' | 'local' }> => {
    if (budget <= 0) throw new Error('예산을 먼저 입력해주세요.');

    const candidates = await collectBudgetCandidates(title, desiredItems);
    try {
      const aiItems = await makeAiBudgetPlan(candidates, title, budget, alloc, desiredItems);
      return { items: balanceItemsByCategory(aiItems, alloc), source: 'ai' };
    } catch {
      const desiredFallback = filterItemsByDesiredIntent(buildRecommendation(candidates, alloc), desiredItems);
      const fallback = Object.values(desiredItems).some(value => splitDesiredItems(value).length > 0)
        ? desiredFallback
        : filterItemsByTitleIntent(desiredFallback, title);
      if (fallback.length === 0) throw new Error('예산안 품목을 만들지 못했습니다. Gemini API 키, 예산 금액, 과목별 비율을 확인해주세요.');
      return { items: balanceItemsByCategory(fallback, alloc), source: 'local' };
    }
  };

  const autoBalancePlan = () => {
    if (!activePlan || activePlan.items.length === 0) return;
    const budget = activePlan.totalBudget ?? 0;
    const solved = solveZeroBalance(activePlan.items, budget);

    updatePlanItems(solved.items);
    setRecommendationStatus('ready');
    setRecommendationMessage(solved.remaining === 0
      ? '직접 수정한 행은 그대로 두고, 나머지 수량을 최소한으로 조정해 잔액을 0원으로 맞췄습니다.'
      : solved.remaining > 0
        ? `직접 수정한 행은 유지한 채 잔액을 ${fmt(solved.remaining)}원까지 줄였습니다. (정확히 0원이 되는 조합이 없거나 수량 한도에 도달했습니다.)`
        : `고정한 행만으로 예산을 ${fmt(Math.abs(solved.remaining))}원 초과했습니다. 일부 행의 수량·단가나 최소 수량을 직접 조정해주세요.`);
  };

  const handleSave = async () => {
    if (!activePlan) return;
    const savedPlan = { ...activePlan, updatedAt: Date.now() };
    setActivePlan(savedPlan);
    const exists = plans.some(plan => plan.id === savedPlan.id);
    await savePlans(exists ? plans.map(plan => plan.id === savedPlan.id ? savedPlan : plan) : [...plans, savedPlan]);
    await savePlannerState(savedPlan.id);
    setRecommendationStatus('ready');
    setRecommendationMessage('예산안을 저장했습니다.');
  };

  const handleExportCsv = async () => {
    if (!activePlan) return;
    const items = activePlan.items;
    const parentIds = parentIdsWithChildren(items);
    const rows: string[][] = [['순', '예산 과목', '품목', '단가(원)', '수량', '소계(원)']];
    items.forEach((item, idx) => {
      const depth = getItemDepth(items, item);
      const blank = isCategoryRow(item) || parentIds.has(item.id); // 상위 행은 단가·수량 빈칸
      const indent = '   '.repeat(Math.max(0, depth - 1));
      rows.push([
        String(idx + 1),
        item.budgetCategory,
        `${indent}${item.thngNm}`,
        blank ? '' : String(item.unitPrice),
        blank ? '' : String(item.quantity),
        String(displaySubtotal(item, items)),
      ]);
    });
    for (const category of CATEGORIES) {
      rows.push(['', category, '집행 합계', '', '', String(usedByCategory[category])]);
    }
    rows.push(['', '', '합계', '', '', String(planTotalUsed)]);
    rows.push(['', '', '배정 예산', '', '', String(activePlan.totalBudget)]);
    rows.push(['', '', '잔액', '', '', String(planRemaining)]);
    await window.electronAPI.saveCsv(toCsv(rows), `${activePlan.title}_예산안작성`);
  };

  const handleImportCsv = async () => {
    if (!activePlan) return;
    try {
      const opened = await window.electronAPI.openCsvFile();
      if (!opened) return;
      const imported = readBudgetItemsFromCsv(opened.content);
      const importedBudget = imported.totalBudget ?? activePlan.totalBudget;
      setActivePlan({
        ...activePlan,
        totalBudget: importedBudget,
        items: imported.items,
        updatedAt: Date.now(),
      });
      setTotalBudget(fmt(importedBudget));
      setRecommendationStatus('ready');
      setRecommendationMessage(`CSV에서 ${imported.items.length}개 품목을 불러왔습니다.`);
    } catch (e: any) {
      setRecommendationStatus('error');
      setRecommendationMessage(e?.message ?? 'CSV를 불러오지 못했습니다.');
    }
  };

  const API_GUIDE_STEPS = [
    { title: 'data.go.kr 접속 및 회원가입', desc: '공공데이터포털(data.go.kr)에 접속해 회원가입합니다.', action: { label: 'data.go.kr 열기', url: 'https://www.data.go.kr' } },
    { title: '조달청 API 검색', desc: '물품목록정보서비스와 종합쇼핑몰 품목정보 서비스를 활용신청합니다.' },
    { title: '활용신청', desc: '상세 페이지에서 활용신청을 누릅니다. 자동승인 후 바로 사용할 수 있습니다.' },
    { title: '인증키 복사', desc: '마이페이지의 개발계정 상세보기에서 일반 인증키를 복사합니다.' },
    { title: 'EduNote에 저장', desc: '아래 입력란에 인증키를 붙여넣고 저장합니다.' },
  ];

  const PRICE_API_GUIDE_STEPS = [
    { title: '공공데이터포털 가입', desc: '공공데이터포털에 회원가입하고 로그인합니다. 나라장터 품목·단가 조회에 쓰는 무료 인증키를 받는 곳입니다.', action: { label: 'data.go.kr 열기', url: 'https://www.data.go.kr' } },
    { title: '서비스 활용신청', desc: '검색창에서 조달청 물품목록정보서비스와 나라장터 종합쇼핑몰 품목정보 서비스를 찾아 각각 활용신청합니다.' },
    { title: '인증키 확인', desc: '마이페이지 - 데이터활용 - 오픈API - 개발계정에서 일반 인증키(Encoding 또는 Decoding)를 복사합니다.' },
    { title: '키 저장', desc: '아래 입력칸에 인증키를 붙여넣고 나라장터 키 저장을 누릅니다. 저장하면 앱을 껐다 켜도 유지됩니다.' },
    { title: '나라장터에 없는 물품', desc: '나라장터 종합쇼핑몰에 없는 일반 시중 물품은 품목 검색 패널의 웹 검색 참고가 조사를 켜면 AI가 웹에서 가격을 찾아 출처와 함께 보여줍니다. 검색 건수만큼 API 요금이 발생하므로 기본은 꺼짐입니다.' },
    { title: '단가 적용 방식', desc: '저장한 키가 있으면 나라장터 계약 단가를 우선 참고하고, 없으면 앱의 예산 생성 로직으로 단가를 추정합니다.' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#FAF9F7] dark:bg-[#171210]">
      <div className="h-14 shrink-0 border-b border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] px-4 flex items-center gap-3">
        <button
          onClick={() => setInputSidebarCollapsed(v => !v)}
          className="p-1.5 rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-[#78716C] dark:text-[#C4B8B0] hover:bg-[#EDE8E1] dark:hover:bg-[#2A2420] transition-colors shrink-0"
          title={inputSidebarCollapsed ? '입력 패널 펼치기' : '입력 패널 접기'}
        >
          {inputSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
        <h1 className="text-base font-black text-[#1C1917] dark:text-[#F0EBE6]">예산안작성</h1>
        <span className="text-xs text-[#A8A29E]">나라장터 품목으로 예산을 0원에 가깝게 맞추기</span>
        <button
          onClick={() => startTour('budget-planner')}
          className="ml-auto inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-xs font-semibold text-purple-600 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors shrink-0"
          title="이 화면 사용법을 단계별로 안내합니다"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          튜토리얼
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <aside data-tour="budget-input" className={`${inputSidebarCollapsed ? 'hidden' : 'block'} w-80 shrink-0 border-r border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] overflow-y-auto`}>
          <section className="p-4 border-b border-[#EDE8E1] dark:border-[#2E2822]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#44403C] dark:text-[#C4B8B0] uppercase tracking-wide">가격 조회 정보 선택 입력</span>
              <button onClick={() => setShowPriceSettings(v => !v)} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                {showPriceSettings ? '닫기' : '열기'} {showPriceSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
            <p className="text-[11px] text-[#78716C] dark:text-[#9C8F87] leading-relaxed">
              선택 입력입니다. 입력하지 않아도 예산안은 만들 수 있고, 입력하면 실제 검색 단가를 참고합니다.
            </p>
            {showPriceSettings && (
              <>
            <button onClick={() => { setShowApiGuide(!showApiGuide); setApiGuideStep(1); }} className="mb-2 text-xs text-blue-500 hover:underline flex items-center gap-1">
              발급 방법 {showApiGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showApiGuide && (
              <div className="mb-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-xs">
                <div className="flex gap-1 mb-2">
                  {PRICE_API_GUIDE_STEPS.map((_, i) => (
                    <button key={i} onClick={() => setApiGuideStep(i + 1)}
                      className={`w-6 h-6 rounded-full text-[10px] font-bold ${apiGuideStep === i + 1 ? 'bg-blue-600 text-white' : 'bg-[#EDE8E1] dark:bg-[#2E2822] text-[#44403C] dark:text-[#C4B8B0]'}`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
                <p className="font-bold text-blue-800 dark:text-blue-200 mb-1">{PRICE_API_GUIDE_STEPS[apiGuideStep - 1].title}</p>
                <p className="text-blue-700 dark:text-blue-300 leading-relaxed">{PRICE_API_GUIDE_STEPS[apiGuideStep - 1].desc}</p>
                {(PRICE_API_GUIDE_STEPS[apiGuideStep - 1] as any).action && (
                  <button onClick={() => window.electronAPI.openExternal((PRICE_API_GUIDE_STEPS[apiGuideStep - 1] as any).action.url)}
                    className="mt-2 flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                    <ExternalLink className="w-3 h-3" /> {(PRICE_API_GUIDE_STEPS[apiGuideStep - 1] as any).action.label}
                  </button>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={hasSavedNaramarketKey ? '인증키 저장됨 (변경할 때만 입력)' : '인증키 붙여넣기'} className={inputCls} />
              <button onClick={saveApiKey} className={`${btnCls} bg-blue-600 text-white hover:bg-blue-700 shrink-0`}>나라장터 키 저장</button>
            </div>
            <p className="text-[11px] text-[#78716C] dark:text-[#9C8F87] mt-1 leading-relaxed">
              공공데이터포털 마이페이지의 일반 인증키 중 <strong>Encoding</strong> 키를 붙여넣으세요.
            </p>
            <button onClick={testNaramarketKey} disabled={isTestingNaramarket} className={`${btnCls} bg-[#78716C] text-white hover:bg-[#44403C] w-full mt-2`}>
              {isTestingNaramarket ? <RefreshCw className="w-3.5 h-3.5 inline mr-1 animate-spin" /> : <Search className="w-3.5 h-3.5 inline mr-1" />}
              테스트 조회
            </button>
            {naramarketTestMessage && (
              <p className={`text-xs mt-1 flex items-start gap-1 ${naramarketTestMessage.startsWith('연결됨') ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" /> {naramarketTestMessage}
              </p>
            )}
            {(apiKey || hasSavedNaramarketKey) && <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> API 키 설정됨</p>}
            <p className="text-[11px] text-[#78716C] dark:text-[#9C8F87] mt-1 leading-relaxed">
              저장 후 예산안 화면 위쪽의 '품목 검색으로 추가'에서 검색하면 실제 단가를 가져와 바로 추가할 수 있습니다.
            </p>
              </>
            )}
          </section>

          <section className="p-4 border-b border-[#EDE8E1] dark:border-[#2E2822] space-y-2">
            <p className="text-xs font-bold text-[#44403C] dark:text-[#C4B8B0] uppercase tracking-wide">1. 예산 정보</p>
            <input value={planTitle} onChange={e => setPlanTitle(e.target.value)} placeholder={`예: ${DEFAULT_BUDGET_TITLE}`} className={inputCls} />
            <input value={totalBudget} onChange={e => setTotalBudget(moneyInput(e.target.value))} placeholder={`예: ${DEFAULT_BUDGET_TOTAL}원`} className={inputCls} />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setUseCategoryRatio(true)}
                className={`${btnCls} justify-center border ${useCategoryRatio ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-[#221E1B] text-[#44403C] dark:text-[#C4B8B0] border-[#E7E5E4] dark:border-[#2E2822] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]'}`}
              >
                과목별 비율
              </button>
              <button
                onClick={() => setUseCategoryRatio(false)}
                className={`${btnCls} justify-center border ${!useCategoryRatio ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-[#221E1B] text-[#44403C] dark:text-[#C4B8B0] border-[#E7E5E4] dark:border-[#2E2822] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]'}`}
              >
                일반 작성
              </button>
            </div>
          </section>

          <section className="p-4 border-b border-[#EDE8E1] dark:border-[#2E2822] space-y-3">
            {useCategoryRatio ? (
              <button onClick={() => setShowRatio(v => !v)} className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                {showRatio ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                2. 과목별 비율과 구입하고자 하는 물품
              </button>
            ) : (
              <p className="text-xs font-bold text-[#44403C] dark:text-[#C4B8B0] uppercase tracking-wide">2. 구입하고자 하는 물품</p>
            )}
            {useCategoryRatio && showRatio && CATEGORIES.map(category => (
              <div key={category} className="rounded-lg bg-[#FAF9F7] dark:bg-[#171210]/40 p-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-20 text-xs font-bold text-[#44403C] dark:text-[#C4B8B0]">{category}</span>
                  <input
                    type="number"
                    min={0}
                    value={category === '교육운영비' ? ratioEdu : category === '일반운영비' ? ratioGeneral : ratioBiz}
                    onChange={e => category === '교육운영비' ? setRatioEdu(e.target.value) : category === '일반운영비' ? setRatioGeneral(e.target.value) : setRatioBiz(e.target.value)}
                    className="w-16 px-2 py-1 text-xs border border-[#E7E5E4] dark:border-[#2E2822] rounded bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6]"
                  />
                  <span className="text-xs text-[#78716C]">% · {fmt(allocations[category])}원</span>
                </div>
                <input value={keywordMap[category]} onChange={e => setKeywordMap[category](e.target.value)} placeholder={`예: ${CATEGORY_KEYWORDS[category].join(', ')}`} className={inputCls} />
              </div>
            ))}
            {!useCategoryRatio && (
              <input
                value={keywordFree}
                onChange={e => setKeywordFree(e.target.value)}
                placeholder="예: 에듀테크 라이선스, 강사비, 홍보용품, 식비"
                className={inputCls}
              />
            )}
            <button
              data-tour="budget-generate"
              onClick={handleNewPlan}
              disabled={!planTitle.trim() || !totalBudget || recommendationStatus === 'loading'}
              className={`${btnCls} mt-2 w-full bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ring-2 ring-purple-200 dark:ring-purple-900 flex items-center justify-center gap-2`}
            >
              {recommendationStatus === 'loading'
                ? <><RefreshCw className="w-4 h-4 animate-spin" />예산안 만드는 중...</>
                : <><Wand2 className="w-4 h-4" />예산안 만들기</>}
            </button>
          </section>

          {plans.length > 0 && (
            <section className="p-4 border-b border-[#EDE8E1] dark:border-[#2E2822]">
              <p className="text-xs font-bold text-[#44403C] dark:text-[#C4B8B0] uppercase tracking-wide mb-2">저장된 계획</p>
              <div className="space-y-1">
                {plans.map(plan => (
                  <button key={plan.id} onClick={() => { const normalized = normalizeBudgetPlan(plan); setActivePlan(normalized); setPlanTitle(normalized.title); setTotalBudget(fmt(normalized.totalBudget)); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs ${activePlan?.id === plan.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold' : 'hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420] text-[#44403C] dark:text-[#C4B8B0]'}`}>
                    <p className="font-semibold truncate">{plan.title}</p>
                    <p className="text-[#A8A29E]">{fmt(plan.totalBudget)}원</p>
                    <p className="text-[10px] text-[#A8A29E]">저장 {formatSavedAt(plan.updatedAt || plan.createdAt)}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

        </aside>

        <main data-tour="budget-output" className="flex-1 flex flex-col overflow-hidden">
          {!activePlan ? (
            <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
              <section className="rounded-xl border border-blue-100 dark:border-blue-800 bg-white dark:bg-[#221E1B] p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-300 mb-1">예시 예산 미리보기</p>
                    <h2 className="text-base font-black text-[#1C1917] dark:text-[#F0EBE6]">{DEFAULT_BUDGET_TITLE}</h2>
                    <p className="text-xs text-[#78716C] dark:text-[#9C8F87] mt-1">
                      왼쪽 입력값 그대로 예산안 만들기를 누르면 아래 예시가 편집 가능한 예산안으로 들어갑니다.
                    </p>
                  </div>
                  <div className="text-right text-xs text-[#78716C] dark:text-[#9C8F87]">
                    <p>배정 예산</p>
                    <p className="text-lg font-black text-[#1C1917] dark:text-[#F0EBE6]">{DEFAULT_BUDGET_TOTAL}원</p>
                  </div>
                </div>
                <BudgetSummary total={examplePreviewBudget} used={examplePreviewTotal} remaining={examplePreviewBudget - examplePreviewTotal} />
              </section>

              <ExampleBudgetPreview items={examplePreviewItems} />
            </div>
          ) : (
            <>
              <header className="shrink-0 border-b border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] px-6 py-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-[#1C1917] dark:text-[#F0EBE6]">{activePlan.title}</h2>
                    <p className="text-xs text-[#78716C]">배정 예산: {fmt(activePlan.totalBudget)}원</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <div className="relative flex items-center gap-1">
                      <button onClick={autoBalancePlan} className={`${btnCls} bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-200 dark:ring-emerald-800 shadow-sm flex items-center gap-1.5`}>
                        <RefreshCw className="w-3.5 h-3.5" />0원 맞추기
                      </button>
                      <button
                        onClick={() => setShowBalanceHelp(v => !v)}
                        className="p-1 rounded-full text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                        title="사용법 보기"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                      {showBalanceHelp && (
                        <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-[#221E1B] shadow-lg p-3 text-xs text-[#44403C] dark:text-[#C4B8B0] space-y-2">
                          <button onClick={() => setShowBalanceHelp(false)} className="absolute top-2 right-2 text-[#A8A29E] hover:text-[#78716C]">
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">0원 맞추기 사용법</p>
                          <ol className="space-y-1.5 ml-1">
                            <li className="flex gap-2"><span className="flex-shrink-0 w-4 h-4 bg-emerald-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">1</span><span>예산안을 AI로 생성한 뒤 남은예산이 0이 아닐 때 사용합니다.</span></li>
                            <li className="flex gap-2"><span className="flex-shrink-0 w-4 h-4 bg-emerald-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">2</span><span>버튼을 누르면 품목 수량을 자동 조절해 남은예산을 최대한 0원에 맞춥니다.</span></li>
                            <li className="flex gap-2"><span className="flex-shrink-0 w-4 h-4 bg-emerald-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">3</span><span><strong>수량 조절 범위 지정:</strong> 각 품목 행의 <strong>최소수량</strong>·<strong>최대수량</strong> 칸을 채우면 그 범위 안에서만 수량을 조절합니다. 특정 품목의 수량을 고정하려면 수량을 직접 수정하면 잠금(고정) 상태가 됩니다.</span></li>
                            <li className="flex gap-2"><span className="flex-shrink-0 w-4 h-4 bg-emerald-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">4</span><span>결과가 만족스럽지 않으면 수량을 직접 조정한 뒤 다시 눌러보세요.</span></li>
                          </ol>
                          <p className="text-[10px] text-[#A8A29E] mt-1">💡 최소·최대 수량을 설정하지 않으면 최소 1 ~ 최대 제한 없음으로 처리됩니다.</p>
                        </div>
                      )}
                    </div>
                    <button onClick={() => window.electronAPI.openExternal(BUDGET_NOTEBOOK_LM_URL)} className={`${btnCls} bg-white dark:bg-[#221E1B] border border-[#E7E5E4] dark:border-[#2E2822] text-[#44403C] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] flex items-center gap-1`}>
                      <ExternalLink className="w-3.5 h-3.5" />예산 질문하기
                    </button>
                    <button onClick={handleSave} className={`${btnCls} bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1`}>
                      <Save className="w-3.5 h-3.5" />저장
                    </button>
                    <button onClick={handleImportCsv} className={`${btnCls} bg-white dark:bg-[#221E1B] border border-[#E7E5E4] dark:border-[#2E2822] text-[#44403C] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] flex items-center gap-1`}>
                      <Upload className="w-3.5 h-3.5" />CSV 불러오기
                    </button>
                    <button onClick={handleExportCsv} className={`${btnCls} bg-green-600 text-white hover:bg-green-700 flex items-center gap-1`}>
                      <Download className="w-3.5 h-3.5" />CSV 다운로드
                    </button>
                  </div>
                </div>
                {recommendationMessage && (
                  <p className={`text-xs flex items-center gap-1 ${recommendationStatus === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                    {recommendationStatus === 'error' ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                    {recommendationMessage}
                  </p>
                )}
                <BudgetSummary total={activePlan.totalBudget} used={planTotalUsed} remaining={planRemaining} />
              </header>

              <div className="flex-1 overflow-auto px-4 py-3 space-y-4">
                <section className="rounded-xl border border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-blue-500" />
                      <h3 className="text-sm font-black text-[#1C1917] dark:text-[#F0EBE6]">품목 검색으로 추가</h3>
                    </div>
                    <button
                      onClick={() => { setPriceSearchResults([]); setPriceSearchMessage(''); setPriceSearchQuery(''); setPriceSearchStatus('idle'); setPriceSearchHasMore(false); setPriceSearchPage(1); }}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[#78716C] hover:text-[#1C1917] hover:bg-[#EDE8E1] dark:text-[#9C8F87] dark:hover:text-[#F0EBE6] dark:hover:bg-[#2A2420]"
                      title="가격 조회 입력과 결과를 지웁니다"
                    >
                      <X className="w-3.5 h-3.5" />닫기
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {useCategoryRatio && (
                      <select
                        value={priceSearchCategory}
                        onChange={e => setPriceSearchCategory(e.target.value as BudgetCategory)}
                        className="px-2 py-1.5 text-sm border border-[#E7E5E4] dark:border-[#2E2822] rounded-lg bg-white dark:bg-[#171210] text-[#1C1917] dark:text-[#F0EBE6]"
                      >
                        {CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                      </select>
                    )}
                    <input
                      value={priceSearchQuery}
                      onChange={e => setPriceSearchQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handlePriceSearch(); }}
                      placeholder="예: 태블릿, 복사용지, 보드게임"
                      className={`${inputCls} flex-1 min-w-[160px]`}
                    />
                    <button onClick={handlePriceSearch} disabled={priceSearchStatus === 'loading' || !priceSearchQuery.trim()} title={priceSearchTooltip} className={`${btnCls} bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1`}>
                      {priceSearchStatus === 'loading' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      조회
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#44403C] dark:text-[#C4B8B0] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useMarketPriceSearch}
                        onChange={e => setUseMarketPriceSearch(e.target.checked)}
                        className="w-3.5 h-3.5 accent-blue-600"
                      />
                      웹 검색으로 시중 참고가 함께 조사
                    </label>
                    <button
                      onClick={openDirectPriceSearch}
                      disabled={!priceSearchQuery.trim()}
                      title="쇼핑 검색 결과를 창으로 열어 직접 가격을 확인합니다"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:text-[#A8A29E] disabled:no-underline"
                    >
                      <ExternalLink className="w-3 h-3" />직접 검색하기
                    </button>
                  </div>
                  {useMarketPriceSearch && (
                    <p className="text-[11px] text-[#78716C] dark:text-[#9C8F87] mt-1.5 flex items-start gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                      웹 검색 참고가는 조사 시점의 판매가라 실제 구매가와 다를 수 있습니다. 반드시 출처를 열어 확인하세요. 검색 건수만큼 API 요금이 발생합니다.
                    </p>
                  )}
                  {!hasPriceLookupKey && !useMarketPriceSearch && (
                    <p className="text-[11px] text-[#78716C] dark:text-[#9C8F87] mt-1.5 flex items-start gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                      나라장터 인증키를 저장하거나 위 '웹 검색으로 시중 참고가 함께 조사'를 켜면 검색을 사용할 수 있습니다.
                    </p>
                  )}
                  {priceSearchMessage && (
                    <p className={`text-xs mt-2 flex items-center gap-1 ${priceSearchStatus === 'error' ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                      {priceSearchStatus === 'error' ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      {priceSearchMessage}
                    </p>
                  )}
                  {priceSearchResults.length > 0 && (
                    <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] divide-y divide-[#EDE8E1] dark:divide-[#2E2822]">
                      {priceSearchResults.map((item, idx) => {
                        const preview = item.image ? previewImages[item.image] : undefined;
                        return (
                        <div
                          key={`${item.thngCd}-${idx}`}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-[#FAF9F7] dark:hover:bg-[#171210]/40"
                          onMouseEnter={() => loadPreviewImage(item.image)}
                        >
                          {item.image && (
                            <div className="shrink-0 h-14 w-14 rounded border border-[#EDE8E1] dark:border-[#2E2822] overflow-hidden bg-[#FAF9F7] dark:bg-[#171210] flex items-center justify-center" title={item.thngNm}>
                              {preview
                                ? <img src={preview} alt="" className="h-full w-full object-contain" />
                                : <span className="text-[9px] text-[#A8A29E] text-center leading-tight px-0.5">{preview === '' ? '사진 없음' : '불러오는 중'}</span>}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#1C1917] dark:text-[#F0EBE6] truncate">
                              {item.thngNm}
                              {item.priceSource === MARKET_PRICE_SOURCE_LABEL && (
                                <span className="ml-1.5 align-middle rounded-full bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">참고가</span>
                              )}
                            </p>
                            <p className="text-[11px] text-[#78716C] dark:text-[#9C8F87] truncate">
                              {[
                                item.priceSource,
                                extractNaraIdNo(item.thngCd) && `식별번호 ${extractNaraIdNo(item.thngCd)}`,
                                item.spec,
                                item.mnfctCorpNm,
                              ].filter(Boolean).join(' · ')}
                              {item.priceSourceUrl && (
                                <button onClick={() => openSourceLink(item.priceSourceUrl!)}
                                  onMouseEnter={() => loadPreviewImage(item.image)}
                                  className="ml-1 text-blue-500 hover:underline inline-flex items-center gap-0.5">
                                  <ExternalLink className="w-3 h-3" />열기
                                </button>
                              )}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-[#1C1917] dark:text-[#F0EBE6] shrink-0">{fmt(item.unitPrice ?? 0)}원</span>
                          <button onClick={() => addSearchItemToPlan(item)} className={`${btnCls} bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1 shrink-0`}>
                            <Plus className="w-3.5 h-3.5" />추가
                          </button>
                        </div>
                        );
                      })}
                    </div>
                  )}
                  {priceSearchHasMore && (
                    <div className="mt-2 text-center">
                      <button onClick={handlePriceSearchMore} disabled={priceSearchStatus === 'loading'}
                        className={`${btnCls} bg-white dark:bg-[#221E1B] border border-[#E7E5E4] dark:border-[#2E2822] text-[#44403C] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] inline-flex items-center gap-1`}>
                        {priceSearchStatus === 'loading' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        더 보기
                      </button>
                    </div>
                  )}
                </section>
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-black text-[#1C1917] dark:text-[#F0EBE6]">예산안</h3>
                      <p className="mt-0.5 text-[11px] text-[#78716C] dark:text-[#9C8F87]">
                        최소·최대 수량은 필요한 경우에만 입력하세요.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={toggleCollapseAll} className={`${btnCls} bg-white dark:bg-[#221E1B] border border-[#E7E5E4] dark:border-[#2E2822] text-[#44403C] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] flex items-center gap-1`}>
                        {collapsedBudgetIds.size > 0 ? <><ChevronDown className="w-3.5 h-3.5" />모두 펼치기</> : <><ChevronRight className="w-3.5 h-3.5" />모두 접기</>}
                      </button>
                      {useCategoryRatio && (
                        <button onClick={handleSortByCategory} className={`${btnCls} bg-white dark:bg-[#221E1B] border border-[#E7E5E4] dark:border-[#2E2822] text-[#44403C] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] flex items-center gap-1`}>
                          <Layers className="w-3.5 h-3.5" />과목별 정렬
                        </button>
                      )}
                    </div>
                  </div>
                  <EditableBudgetTable
                    items={useCategoryRatio ? activePlan.items : activePlan.items.filter(item => !isCategoryRow(item))}
                    emptyText="예산안 만들기를 누르거나 왼쪽에서 품목을 추가하세요"
                    totalBudget={activePlan.totalBudget}
                    usedTotal={planTotalUsed}
                    remaining={planRemaining}
                    allocations={allocations}
                    usedByCategory={usedByCategory}
                    showCategoryRatio={useCategoryRatio}
                    collapsedIds={collapsedBudgetIds}
                    onToggleCollapse={(id) => setCollapsedBudgetIds(prev => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })}
                    onChange={(id, patch) => {
                      const updated = updateRows(activePlan.items, id, patch);
                      // 과목을 바꾼 경우 해당 품목을 새 과목 루트 아래로 다시 정렬한다.
                      updatePlanItems(patch.budgetCategory ? normalizeToCategoryTree(updated) : updated);
                    }}
                    onAddChild={addChildItemToPlan}
                    onRemove={(id) => {
                      const removeIds = collectDescendantIds(activePlan.items, id);
                      removeIds.add(id);
                      updatePlanItems(activePlan.items.filter(item => !removeIds.has(item.id)));
                    }}
                  />
                </section>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function normalizeApiItems(data: any, preferPrice: boolean): NaraItem[] {
  const raw = data?.response?.body?.items ?? data?.body?.items ?? [];
  const source = raw?.item ?? raw;
  const rows = Array.isArray(source) ? source : (source ? [source] : []);
  return rows.map((row: any) => {
    const unitPrice = Number(
      row.cntrctPrceAmt ?? row.cntrctPrce ?? row.cntrctAmt ?? row.prdctUprc ?? row.unitPrice ?? row.price ?? 0
    ) || undefined;
    return {
      thngNm: row.prdctIdntNoNm || row.krnPrdctNm || row.prdctClsfcNoNm || row.dtilPrdctClsfcNoNm || row.prdctNm || '(이름 없음)',
      thngCd: pickNaraIdNo(row) || String(row.prdctNo ?? ''),
      spec: row.itemSpec || row.prdctSpecNm || row.stdUntNm || row.prdctClsfcNoNm || row.dtilPrdctClsfcNoNm || '',
      mnfctCorpNm: row.cntrctCorpNm || row.mnfctCorpNm || row.prdctMakrNm || row.mnfctCmpyNm || '',
      unitPrice: preferPrice ? unitPrice : undefined,
      image: toNaraImageUrl(row.prdctImgUrl) || undefined,
    };
  });
}

function uniqueSearchItems(items: NaraItem[]): NaraItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.thngCd}-${item.thngNm}-${item.unitPrice ?? 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function BudgetSummary({ total, used, remaining }: { total: number; used: number; remaining: number }) {
  const remainingTone = remaining === 0
    ? 'border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
    : remaining < 0
      ? 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
      : 'border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300';
  const remainingLabel = remaining === 0 ? '딱 맞음' : remaining < 0 ? '초과' : '남음';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
        <p className="text-[11px] font-bold text-blue-600 dark:text-blue-300 mb-1">배정예산</p>
        <p className="text-xl font-black text-blue-900 dark:text-blue-100">{fmt(total)}원</p>
      </div>
      <div className="rounded-xl border border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] px-4 py-3">
        <p className="text-[11px] font-bold text-[#78716C] dark:text-[#C4B8B0] mb-1">집행예산</p>
        <p className="text-xl font-black text-[#1C1917] dark:text-[#F0EBE6]">{fmt(used)}원</p>
      </div>
      <div className={`rounded-xl border px-4 py-3 ${remainingTone}`}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-[11px] font-bold">남은예산</p>
          <span className="text-[10px] font-black rounded-full bg-white/70 dark:bg-black/20 px-2 py-0.5">{remainingLabel}</span>
        </div>
        <p className="text-xl font-black">{fmt(Math.abs(remaining))}원</p>
      </div>
    </div>
  );
}

function ExampleBudgetPreview({ items }: { items: BudgetItem[] }) {
  const parentIds = parentIdsWithChildren(items);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const previewTotal = countableItems(items).reduce((sum, item) => sum + item.subtotal, 0);
  const previewBudget = parseMoney(DEFAULT_BUDGET_TOTAL);
  const previewAllocations: Record<BudgetCategory, number> = {
    교육운영비: 7500000,
    일반운영비: 2000000,
    업무추진비: 500000,
  };
  const previewUsedByCategory = CATEGORIES.reduce((acc, category) => {
    acc[category] = countableItems(items).filter(item => item.budgetCategory === category).reduce((sum, item) => sum + item.subtotal, 0);
    return acc;
  }, { 교육운영비: 0, 일반운영비: 0, 업무추진비: 0 } as Record<BudgetCategory, number>);
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-black text-[#1C1917] dark:text-[#F0EBE6]">예산안 예시</h3>
      </div>
      <div className="overflow-auto rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B]">
        <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#EDE8E1] dark:bg-[#2E2822] text-xs text-[#44403C] dark:text-[#C4B8B0]">
              <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 text-center w-8">순</th>
              <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 w-28">예산 과목</th>
              <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 min-w-52">품목</th>
                <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 w-28 text-right">단가</th>
              <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 w-20 text-center">최소</th>
              <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 w-20 text-center">수량</th>
              <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 w-20 text-center">최대</th>
              <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 w-32 text-right">소계</th>
              <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.filter(item => !hasCollapsedAncestor(items, item, collapsedIds)).map((item, idx) => {
              const depth = getItemDepth(items, item);
              const categoryColor = CATEGORY_COLORS[item.budgetCategory];
              const indentClass = depth === 1 ? '' : depth === 2 ? 'pl-5' : 'pl-9';
              const isParent = parentIds.has(item.id);
              const isCollapsed = collapsedIds.has(item.id);
              return (
                <tr key={item.id} className={`${budgetRowClass(categoryColor, depth)} ${depth > 1 ? 'border-l-4 border-l-blue-300 dark:border-l-blue-700' : ''}`}>
                  <td className="border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5 text-center text-[#78716C]">{idx + 1}</td>
                  <td className={`border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5 text-xs font-semibold ${categoryColor.cell}`}>
                    {item.budgetCategory}
                  </td>
                  <td className="border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5">
                    <div className={`${indentClass} ${isParent ? 'font-black text-[#1C1917] dark:text-[#F0EBE6]' : 'text-[#1C1917] dark:text-[#F0EBE6]'} flex items-center gap-1`}>
                      {isParent ? (
                        <button
                          onClick={() => setCollapsedIds(prev => {
                            const next = new Set(prev);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          })}
                          className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
                        >
                          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      ) : depth > 1 ? <span className="w-4 text-[#A8A29E]">└</span> : <span className="w-4" />}
                      <span>{item.thngNm}</span>
                    </div>
                  </td>
                  <td className="border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5 text-right text-xs text-[#1C1917] dark:text-[#F0EBE6]">
                    {isParent ? '' : fmt(item.unitPrice)}
                  </td>
                  <td className="border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5 text-center text-xs text-[#78716C] dark:text-[#C4B8B0]">
                    {item.minQuantity ?? ''}
                  </td>
                  <td className="border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5 text-center text-xs text-[#1C1917] dark:text-[#F0EBE6]">
                    {isParent ? '' : item.quantity}
                  </td>
                  <td className="border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5 text-center text-xs text-[#78716C] dark:text-[#C4B8B0]">
                    {item.maxQuantity ?? ''}
                  </td>
                  <td className="border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5 text-right text-xs font-bold text-[#1C1917] dark:text-[#F0EBE6]">
                    {fmt(displaySubtotal(item, items))}
                  </td>
                  <td className="border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5"></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {CATEGORIES.map(category => (
              <tr key={category} className={`${CATEGORY_COLORS[category].footer} text-xs`}>
                <td colSpan={7} className="border border-[#E7E5E4] dark:border-[#2E2822] px-3 py-1.5 text-right text-[#44403C] dark:text-[#C4B8B0]">
                  {category} 배정 {fmt(previewAllocations[category])}원 / 집행 {fmt(previewUsedByCategory[category])}원
                </td>
                <td className={`border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-1.5 text-right font-bold ${previewAllocations[category] - previewUsedByCategory[category] < 0 ? 'text-red-600' : 'text-[#44403C] dark:text-[#C4B8B0]'}`}>
                  {fmt(previewAllocations[category] - previewUsedByCategory[category])}
                </td>
                <td className="border border-[#E7E5E4] dark:border-[#2E2822]"></td>
              </tr>
            ))}
            <tr className="bg-[#FAF9F7] dark:bg-[#2E2822]/50 font-bold text-sm">
              <td colSpan={7} className="border border-[#E7E5E4] dark:border-[#2E2822] px-3 py-2 text-right">합계</td>
              <td className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 text-right text-blue-700 dark:text-blue-300">{fmt(previewTotal)}</td>
              <td className="border border-[#E7E5E4] dark:border-[#2E2822]"></td>
            </tr>
            <tr className="bg-[#FAF9F7] dark:bg-[#2E2822]/50 text-sm">
              <td colSpan={7} className="border border-[#E7E5E4] dark:border-[#2E2822] px-3 py-2 text-right text-[#44403C] dark:text-[#9C8F87]">배정 예산</td>
              <td className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 text-right text-[#44403C] dark:text-[#C4B8B0]">{fmt(previewBudget)}</td>
              <td className="border border-[#E7E5E4] dark:border-[#2E2822]"></td>
            </tr>
            <tr className="text-sm font-black bg-green-50 dark:bg-green-900/20">
              <td colSpan={7} className="border border-[#E7E5E4] dark:border-[#2E2822] px-3 py-2 text-right">잔액</td>
              <td className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 text-right text-green-700 dark:text-green-400">
                {fmt(previewBudget - previewTotal)}
              </td>
              <td className="border border-[#E7E5E4] dark:border-[#2E2822]"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function EditableBudgetTable({
  items,
  emptyText,
  totalBudget,
  usedTotal,
  remaining,
  allocations,
  usedByCategory,
  showCategoryRatio,
  collapsedIds,
  onToggleCollapse,
  onChange,
  onAddChild,
  onRemove,
}: {
  items: BudgetItem[];
  emptyText: string;
  totalBudget: number;
  usedTotal: number;
  remaining: number;
  allocations: Record<BudgetCategory, number>;
  usedByCategory: Record<BudgetCategory, number>;
  showCategoryRatio: boolean;
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  onChange: (id: string, patch: Partial<Pick<BudgetItem, 'budgetCategory' | 'thngNm' | 'unitPrice' | 'quantity' | 'minQuantity' | 'maxQuantity' | 'spec'>>) => void;
  onAddChild: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="h-28 flex items-center justify-center rounded-lg border border-dashed border-[#E7E5E4] dark:border-[#2E2822] text-[#A8A29E] text-sm">
        {emptyText}
      </div>
    );
  }

  const parentIds = parentIdsWithChildren(items);

  return (
    <div className="overflow-auto rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B]">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#EDE8E1] dark:bg-[#2E2822] text-xs text-[#44403C] dark:text-[#C4B8B0]">
            <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 text-center w-8">순</th>
            <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 w-28">예산 과목</th>
            <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 min-w-52">품목</th>
            <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 w-28 text-right">단가</th>
            <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 w-20 text-center">최소</th>
            <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 w-20 text-center">수량</th>
            <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 w-20 text-center">최대</th>
            <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 w-32 text-right">소계</th>
            <th className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {items.filter(item => !hasCollapsedAncestor(items, item, collapsedIds)).map((item, idx) => {
            const categoryColor = CATEGORY_COLORS[item.budgetCategory];
            const adjustedCellClass = item.quantityAdjusted ? 'bg-amber-100 dark:bg-amber-900/40 ring-1 ring-amber-300 dark:ring-amber-600' : '';
            const isCategory = isCategoryRow(item);
            const isParent = parentIds.has(item.id);
            const depth = getItemDepth(items, item);
            const canAddChild = depth < MAX_BUDGET_DEPTH;
            const isCollapsed = collapsedIds.has(item.id);
            const indentClass = depth === 1 ? '' : depth === 2 ? 'pl-5' : 'pl-9';
            const blankInputs = isCategory || isParent; // 상위(부모) 행은 규격·단가·수량을 비운다
            const blankCell = <td className="border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5"></td>;
            return (
            <tr key={item.id} className={`${budgetRowClass(categoryColor, depth)} ${depth > 1 ? 'border-l-4 border-l-blue-300 dark:border-l-blue-700' : ''}`}>
              <td className="border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5 text-center text-[#78716C]">{idx + 1}</td>
              <td className={`border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5 ${showCategoryRatio ? categoryColor.cell : ''}`}>
                {!showCategoryRatio ? (
                  <span className="block h-5"></span>
                ) : isCategory ? (
                  <span className="block text-xs font-black px-1 py-0.5">{item.budgetCategory}</span>
                ) : (
                  <select value={item.budgetCategory} onChange={e => onChange(item.id, { budgetCategory: e.target.value as BudgetCategory })}
                    disabled={depth >= 3}
                    className={`w-full text-xs border-none rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-70 ${categoryColor.select}`}>
                    {CATEGORIES.map(category => <option key={category}>{category}</option>)}
                  </select>
                )}
              </td>
              <td className="border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5">
                <div className={indentClass}>
                <div className="flex items-center gap-1">
                  {(isCategory || isParent) ? (
                    <button
                      onClick={() => onToggleCollapse(item.id)}
                      className="p-0.5 rounded text-[#78716C] hover:bg-black/5 dark:hover:bg-white/10 dark:text-[#C4B8B0]"
                      title={isCollapsed ? '펼치기' : '접기'}
                    >
                      {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  ) : depth > 1 ? <span className="w-4 text-[#A8A29E]">└</span> : <span className="w-4" />}
                  {isCategory ? (
                    <span className="text-xs font-black text-[#1C1917] dark:text-[#F0EBE6] px-1">{item.budgetCategory}</span>
                  ) : (
                    <input value={item.thngNm} onChange={e => onChange(item.id, { thngNm: e.target.value })}
                      placeholder="품목명" className={`w-full text-xs bg-transparent border-none focus:outline-none text-[#1C1917] dark:text-[#F0EBE6] focus:ring-1 focus:ring-blue-400 rounded px-1 ${isParent ? 'font-semibold' : ''}`} />
                  )}
                  {!isCategory && !isParent && item.thngNm.trim() && (
                    <button
                      onClick={() => window.electronAPI.openPriceSearchWindow(item.thngNm)}
                      className="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded text-[#A8A29E] hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      title="네이버쇼핑에서 이 품목 가격 검색 (별도 창)"
                    >
                      <Search className="w-3 h-3" />
                    </button>
                  )}
                  {isCategory && (
                    <button onClick={() => onAddChild(item.id)} className="shrink-0 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30" title="이 과목에 품목 추가">
                      <Plus className="w-3 h-3" />품목
                    </button>
                  )}
                  {!isCategory && canAddChild && (
                    <button onClick={() => onAddChild(item.id)} className="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded text-[#A8A29E] hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30" title="세부 항목 추가">
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
                </div>
              </td>
              {blankInputs ? blankCell : (
                <td className="border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5">
                  <input type="number" min={0} step={1000} value={item.unitPrice}
                    onChange={e => onChange(item.id, { unitPrice: parseInt(e.target.value, 10) || 0 })}
                    className="w-full text-right text-xs bg-transparent border-none focus:outline-none text-[#1C1917] dark:text-[#F0EBE6] focus:ring-1 focus:ring-blue-400 rounded px-1" />
                  {item.unitPriceLocked && <div className="mt-0.5 text-[10px] text-[#78716C] text-right">고정</div>}
                </td>
              )}
              {blankInputs ? blankCell : (
                <td className="border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5">
                  <input type="number" min={1} value={item.minQuantity ?? ''}
                    onChange={e => onChange(item.id, { minQuantity: e.target.value ? parseInt(e.target.value, 10) || 1 : undefined })}
                    className="w-full text-center text-xs bg-transparent border border-[#E7E5E4] dark:border-[#2E2822] rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-[#1C1917] dark:text-[#F0EBE6]" />
                </td>
              )}
              {blankInputs ? blankCell : (
                <td className={`border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5 ${adjustedCellClass}`}>
                  <input type="number" min={1} value={item.quantity}
                    onChange={e => onChange(item.id, { quantity: parseInt(e.target.value, 10) || 1 })}
                    className="w-full text-center text-xs bg-transparent border border-[#E7E5E4] dark:border-[#2E2822] rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-[#1C1917] dark:text-[#F0EBE6]" />
                  {item.quantityLocked && <div className="mt-0.5 text-[10px] text-[#78716C] text-center">고정</div>}
                  {item.quantityAdjusted && <div className="mt-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 text-center">자동 조정</div>}
                </td>
              )}
              {blankInputs ? blankCell : (
                <td className="border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5">
                  <input type="number" min={item.minQuantity ?? 1} value={item.maxQuantity ?? ''}
                    onChange={e => onChange(item.id, { maxQuantity: e.target.value ? parseInt(e.target.value, 10) || undefined : undefined })}
                    className="w-full text-center text-xs bg-transparent border border-[#E7E5E4] dark:border-[#2E2822] rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-[#1C1917] dark:text-[#F0EBE6]" />
                </td>
              )}
              <td className={`border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5 text-right font-semibold text-[#1C1917] dark:text-[#F0EBE6] text-xs ${adjustedCellClass}`}>
                {fmt(displaySubtotal(item, items))}
              </td>
              <td className="border border-[#EDE8E1] dark:border-[#2E2822] px-2 py-1.5 text-center">
                {!isCategory && (
                  <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600" title="행 삭제">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </td>
            </tr>
          );
          })}
        </tbody>
        <tfoot>
          {showCategoryRatio && CATEGORIES.map(category => (
            <tr key={category} className={`${CATEGORY_COLORS[category].footer} text-xs`}>
              <td colSpan={7} className="border border-[#E7E5E4] dark:border-[#2E2822] px-3 py-1.5 text-right text-[#44403C] dark:text-[#C4B8B0]">
                {category} 배정 {fmt(allocations[category])}원 / 집행 {fmt(usedByCategory[category])}원
              </td>
              <td className={`border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-1.5 text-right font-bold ${allocations[category] - usedByCategory[category] < 0 ? 'text-red-600' : 'text-[#44403C] dark:text-[#C4B8B0]'}`}>
                {fmt(allocations[category] - usedByCategory[category])}
              </td>
              <td className="border border-[#E7E5E4] dark:border-[#2E2822]"></td>
            </tr>
          ))}
          <tr className="bg-[#FAF9F7] dark:bg-[#2E2822]/50 font-bold text-sm">
            <td colSpan={7} className="border border-[#E7E5E4] dark:border-[#2E2822] px-3 py-2 text-right">합계</td>
            <td className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 text-right text-blue-700 dark:text-blue-300">{fmt(usedTotal)}</td>
            <td className="border border-[#E7E5E4] dark:border-[#2E2822]"></td>
          </tr>
          <tr className="bg-[#FAF9F7] dark:bg-[#2E2822]/50 text-sm">
            <td colSpan={7} className="border border-[#E7E5E4] dark:border-[#2E2822] px-3 py-2 text-right text-[#44403C] dark:text-[#9C8F87]">배정 예산</td>
            <td className="border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 text-right text-[#44403C] dark:text-[#C4B8B0]">{fmt(totalBudget)}</td>
            <td className="border border-[#E7E5E4] dark:border-[#2E2822]"></td>
          </tr>
          <tr className={`text-sm font-black ${remaining === 0 ? 'bg-green-50 dark:bg-green-900/20' : remaining < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
            <td colSpan={7} className="border border-[#E7E5E4] dark:border-[#2E2822] px-3 py-2 text-right">잔액</td>
            <td className={`border border-[#E7E5E4] dark:border-[#2E2822] px-2 py-2 text-right ${remaining === 0 ? 'text-green-700 dark:text-green-400' : remaining < 0 ? 'text-red-600' : 'text-amber-700 dark:text-amber-400'}`}>
              {remaining === 0 ? '0' : fmt(remaining)}
            </td>
            <td className="border border-[#E7E5E4] dark:border-[#2E2822]"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
