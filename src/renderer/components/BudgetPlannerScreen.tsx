import React, { useEffect, useMemo, useState } from 'react';
import { BudgetCategory, BudgetItem, BudgetPlan } from '../types';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';

const CATEGORIES: BudgetCategory[] = ['교육운영비', '일반운영비', '업무추진비'];
const DEFAULT_BUDGET_TITLE = '2026. 디지털선도학교 운영 예산';
const DEFAULT_BUDGET_TOTAL = '10,000,000';
const BUDGET_NOTEBOOK_LM_URL = 'https://notebooklm.google.com/notebook/1219f9f1-d26d-4e02-bc29-01a04feb15fb';

const CATEGORY_COLORS: Record<BudgetCategory, { row: string; cell: string; select: string; footer: string }> = {
  교육운영비: {
    row: 'bg-sky-50/70 dark:bg-sky-950/20 hover:bg-sky-100/80 dark:hover:bg-sky-900/30',
    cell: 'bg-sky-100 dark:bg-sky-900/50 text-sky-900 dark:text-sky-100',
    select: 'bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-100',
    footer: 'bg-sky-50 dark:bg-sky-950/30',
  },
  일반운영비: {
    row: 'bg-emerald-50/70 dark:bg-emerald-950/20 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/30',
    cell: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-100',
    select: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100',
    footer: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  업무추진비: {
    row: 'bg-amber-50/70 dark:bg-amber-950/20 hover:bg-amber-100/80 dark:hover:bg-amber-900/30',
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
    { thngNm: '학급 문고 도서', thngCd: 'local-book', spec: '권', unitPrice: 15000 },
    { thngNm: '학습 활동지 인쇄 세트', thngCd: 'local-worksheet', spec: '묶음', unitPrice: 12000 },
    { thngNm: '색연필 세트', thngCd: 'local-colored-pencil', spec: '12색', unitPrice: 7000 },
    { thngNm: '수채화 물감', thngCd: 'local-paint', spec: '12색', unitPrice: 8500 },
    { thngNm: '도화지', thngCd: 'local-paper-art', spec: '100매', unitPrice: 9000 },
    { thngNm: '과학 실험 키트', thngCd: 'local-science-kit', spec: '개', unitPrice: 18000 },
    { thngNm: '줄넘기', thngCd: 'local-rope', spec: '개', unitPrice: 6000 },
    { thngNm: '학습용 보드게임', thngCd: 'local-boardgame', spec: '개', unitPrice: 22000 },
    { thngNm: 'USB 메모리', thngCd: 'local-usb', spec: '32GB', unitPrice: 9000 },
  ],
  일반운영비: [
    { thngNm: '복사용지', thngCd: 'local-copy-paper', spec: 'A4 2500매', unitPrice: 25000 },
    { thngNm: '볼펜', thngCd: 'local-pen', spec: '12개입', unitPrice: 6000 },
    { thngNm: '클리어 파일', thngCd: 'local-clear-file', spec: '20매', unitPrice: 5000 },
    { thngNm: '바인더', thngCd: 'local-binder', spec: '개', unitPrice: 4500 },
    { thngNm: '스테이플러', thngCd: 'local-stapler', spec: '개', unitPrice: 8000 },
    { thngNm: '테이프', thngCd: 'local-tape', spec: '3개입', unitPrice: 4500 },
    { thngNm: '프린터 토너', thngCd: 'local-toner', spec: '개', unitPrice: 85000 },
    { thngNm: '청소용품 세트', thngCd: 'local-cleaning', spec: '세트', unitPrice: 18000 },
    { thngNm: '손세정제', thngCd: 'local-sanitizer', spec: '500ml', unitPrice: 7000 },
    { thngNm: 'AI 문서 작성 라이선스', thngCd: 'local-ai-doc', spec: '1년 구독', unitPrice: 500000 },
    { thngNm: 'AI 콘텐츠 제작 라이선스', thngCd: 'local-ai-content', spec: '1년 구독', unitPrice: 400000 },
    { thngNm: '강사비', thngCd: 'local-lecture-fee', spec: '운영수당', unitPrice: 180000 },
    { thngNm: '원고비', thngCd: 'local-writing-fee', spec: '운영수당', unitPrice: 100000 },
    { thngNm: '홍보용품', thngCd: 'local-promo', spec: '홍보 물품', unitPrice: 260000 },
    { thngNm: '현수막', thngCd: 'local-banner', spec: '홍보물', unitPrice: 200000 },
  ],
  업무추진비: [
    { thngNm: '커피', thngCd: 'local-coffee', spec: '박스', unitPrice: 18000 },
    { thngNm: '차 세트', thngCd: 'local-tea', spec: '박스', unitPrice: 16000 },
    { thngNm: '생수', thngCd: 'local-water', spec: '묶음', unitPrice: 7000 },
    { thngNm: '음료', thngCd: 'local-drink', spec: '박스', unitPrice: 15000 },
    { thngNm: '쿠키', thngCd: 'local-cookie', spec: '상자', unitPrice: 12000 },
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
      { thngNm: '이어폰', thngCd: 'title-earphone', spec: '학습용', unitPrice: 12000, preferred: true },
      { thngNm: '헤드셋', thngCd: 'title-headset', spec: '어학·온라인 학습용', unitPrice: 25000, preferred: true },
    ],
  },
  헤드셋: {
    교육운영비: [
      { thngNm: '헤드셋', thngCd: 'title-headset', spec: '어학·온라인 학습용', unitPrice: 25000, preferred: true },
      { thngNm: '이어폰', thngCd: 'title-earphone', spec: '학습용', unitPrice: 12000, preferred: true },
    ],
  },
  마이크: {
    교육운영비: [
      { thngNm: '마이크', thngCd: 'title-mic', spec: '수업·방송용', unitPrice: 35000, preferred: true },
      { thngNm: '헤드셋', thngCd: 'title-headset', spec: '마이크 포함', unitPrice: 25000, preferred: true },
    ],
  },
  복사용지: {
    일반운영비: [
      { thngNm: '복사용지', thngCd: 'title-copy-paper', spec: 'A4 2500매', unitPrice: 25000, preferred: true },
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
}

type RecommendationStatus = 'idle' | 'loading' | 'ready' | 'error';

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
    { thngNm: '학습 스티커', thngCd: 'balance-learning-sticker', spec: '소액 보정', unitPrice: 500 },
    { thngNm: '색종이', thngCd: 'balance-color-paper', spec: '소액 보정', unitPrice: 1000 },
    { thngNm: '학습 파일', thngCd: 'balance-learning-file', spec: '소액 보정', unitPrice: 2000 },
    { thngNm: '학습 노트', thngCd: 'balance-learning-note', spec: '소액 보정', unitPrice: 3000 },
    { thngNm: '학습 준비물', thngCd: 'balance-learning-supply', spec: '소액 보정', unitPrice: 5000 },
  ],
  일반운영비: [
    { thngNm: '클립', thngCd: 'balance-clip', spec: '소액 보정', unitPrice: 500 },
    { thngNm: '라벨지', thngCd: 'balance-label', spec: '소액 보정', unitPrice: 1000 },
    { thngNm: '파일철', thngCd: 'balance-file-folder', spec: '소액 보정', unitPrice: 2000 },
    { thngNm: '사무용품', thngCd: 'balance-office-supply', spec: '소액 보정', unitPrice: 3000 },
    { thngNm: '정리용품', thngCd: 'balance-organizer', spec: '소액 보정', unitPrice: 5000 },
  ],
  업무추진비: [
    { thngNm: '종이컵', thngCd: 'balance-paper-cup', spec: '소액 보정', unitPrice: 500 },
    { thngNm: '생수', thngCd: 'balance-water', spec: '소액 보정', unitPrice: 1000 },
    { thngNm: '다과', thngCd: 'balance-refreshment', spec: '소액 보정', unitPrice: 2000 },
    { thngNm: '간식', thngCd: 'balance-snack', spec: '소액 보정', unitPrice: 3000 },
    { thngNm: '회의 음료', thngCd: 'balance-meeting-drink', spec: '소액 보정', unitPrice: 5000 },
  ],
};

const fmt = (n: number) => n.toLocaleString('ko-KR');
const genId = () => crypto.randomUUID();
const inputCls = 'w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
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
    priceSource: item?.priceSource ?? (unitPrice > 0 ? '내장 기준단가' : undefined),
    priceSourceUrl: item?.priceSourceUrl,
  };
}

function makeBudgetItem(category: BudgetCategory, thngNm: string, spec: string, unitPrice: number, quantity: number, parentId?: string): BudgetItem {
  const item = makeItem(category, { thngNm, spec, unitPrice, thngCd: 'example-draft', priceSource: '예시 초안' });
  item.quantity = quantity;
  item.subtotal = calcSubtotal(item);
  item.parentId = parentId;
  return item;
}

function buildExampleBudgetItems(): BudgetItem[] {
  const rows: BudgetItem[] = [];
  const add = (category: BudgetCategory, thngNm: string, spec: string, unitPrice = 0, quantity = 1, parentId?: string) => {
    const item = makeBudgetItem(category, thngNm, spec, unitPrice, quantity, parentId);
    rows.push(item);
    return item;
  };

  const edutech = add('교육운영비', '에듀테크 라이선스', '하위항목 합계');
  const classTools = add('교육운영비', '수업 참여 도구', '하위항목 합계', 0, 1, edutech.id);
  add('교육운영비', '패들렛', '1년 구독', 1500000, 1, classTools.id);
  add('교육운영비', '젭퀴즈', '1년 구독', 1500000, 1, classTools.id);
  const courseware = add('교육운영비', 'AI 코스웨어', '하위항목 합계', 0, 1, edutech.id);
  add('교육운영비', 'AI 코스웨어 라이선스', '1년 구독', 2000000, 1, courseware.id);

  const studentSupport = add('교육운영비', '학생 지원 물품', '하위항목 합계');
  const snacks = add('교육운영비', '학생 간식', '하위항목 합계', 0, 1, studentSupport.id);
  add('교육운영비', '수업 참여 간식', '행사 및 수업 참여 간식', 5000, 120, snacks.id);
  const souvenirs = add('교육운영비', '참여 학생 기념품', '하위항목 합계', 0, 1, studentSupport.id);
  add('교육운영비', '참여 학생 기념품', '기념품', 5000, 80, souvenirs.id);

  const event = add('교육운영비', '행사 예산', '하위항목 합계');
  const sharing = add('교육운영비', '디지털 수업 나눔 행사', '하위항목 합계', 0, 1, event.id);
  add('교육운영비', '행사 운영 물품', '1식', 800000, 1, sharing.id);
  const report = add('교육운영비', '성과 공유회', '하위항목 합계', 0, 1, event.id);
  add('교육운영비', '성과 공유회 운영 물품', '1식', 500000, 1, report.id);
  const booth = add('교육운영비', '체험 부스', '하위항목 합계', 0, 1, event.id);
  add('교육운영비', '체험 부스 운영 물품', '1식', 200000, 1, booth.id);

  const aiLicense = add('일반운영비', 'AI 라이선스', '하위항목 합계');
  const workAi = add('일반운영비', '업무 지원 AI', '하위항목 합계', 0, 1, aiLicense.id);
  add('일반운영비', 'AI 문서 작성 라이선스', '1년 구독', 500000, 1, workAi.id);
  add('일반운영비', 'AI 콘텐츠 제작 라이선스', '1년 구독', 400000, 1, workAi.id);

  const fee = add('일반운영비', '강사 및 원고 수당', '하위항목 합계');
  const operatingAllowance = add('일반운영비', '운영수당', '하위항목 합계', 0, 1, fee.id);
  add('일반운영비', '강사비', '운영수당', 180000, 3, operatingAllowance.id);
  add('일반운영비', '원고비', '운영수당', 100000, 1, operatingAllowance.id);

  const promo = add('일반운영비', '홍보 및 운영 물품', '하위항목 합계');
  const promoProduction = add('일반운영비', '홍보물 제작', '하위항목 합계', 0, 1, promo.id);
  add('일반운영비', '홍보용품', '홍보 물품', 260000, 1, promoProduction.id);
  add('일반운영비', '현수막', '홍보물', 200000, 1, promoProduction.id);

  const biz = add('업무추진비', '업무추진 식비 및 다과비', '하위항목 합계');
  const meeting = add('업무추진비', '협의회 운영', '하위항목 합계', 0, 1, biz.id);
  add('업무추진비', '식비', '협의회 식비', 350000, 1, meeting.id);
  add('업무추진비', '다과비', '협의회 다과', 150000, 1, meeting.id);

  return rows;
}

function makeSmallBalanceItem(category: BudgetCategory, candidate: NaraItem, quantity: number): BudgetItem {
  const item = makeItem(category, candidate);
  item.quantity = Math.max(1, quantity);
  item.subtotal = calcSubtotal(item);
  item.memo = AUTO_BALANCE_MEMO;
  item.priceSource = '소액 보정';
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
  if (/식비|도시락/.test(name)) return 12000;
  if (/다과|간식|과자|쿠키|음료/.test(name)) return 15000;
  if (/토너|프린터|카트리지/.test(name)) return 85000;
  if (/키트|세트|보드게임|다과/.test(name)) return 25000;
  if (/도서|책|교재/.test(name)) return 15000;
  if (/복사용지|용지/.test(name)) return 25000;
  if (/커피|음료|차|과자|쿠키/.test(name)) return 15000;
  if (/파일|테이프|볼펜|펜|수건/.test(name)) return 6000;
  if (category === '일반운영비') return 10000;
  if (category === '업무추진비') return 15000;
  return 12000;
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
  if (headerIndex < 0) throw new Error('예산사용계획 CSV 형식이 아닙니다.');
  const header = rows[headerIndex].map(value => value.trim());
  const idx = (name: string) => header.indexOf(name);
  const categoryIdx = idx('예산 과목');
  const nameIdx = idx('품목');
  const codeIdx = idx('품목코드');
  const specIdx = idx('규격');
  const priceIdx = idx('단가(원)');
  const qtyIdx = idx('수량');
  const subtotalIdx = idx('소계(원)');
  const depthIdx = idx('단계');
  const parentIdx = idx('상위항목');
  const items: BudgetItem[] = [];
  const latestByDepth = new Map<number, string>();
  let totalBudget: number | null = null;

  for (const row of rows.slice(headerIndex + 1)) {
    const label = row[specIdx]?.trim();
    const amount = parseInt((row[subtotalIdx] ?? '').replace(/[^0-9-]/g, ''), 10) || 0;
    if (label === '배정 예산') totalBudget = amount;

    const category = normalizeBudgetCategory(row[categoryIdx]?.trim());
    const thngNm = row[nameIdx]?.trim();
    if (!category || !thngNm) continue;

    const unitPrice = parseInt((row[priceIdx] ?? '').replace(/[^0-9]/g, ''), 10) || 0;
    const quantity = Math.max(1, parseInt((row[qtyIdx] ?? '').replace(/[^0-9]/g, ''), 10) || 1);
    const depth = Math.min(MAX_BUDGET_DEPTH, Math.max(1, parseInt((row[depthIdx] ?? '').replace(/[^0-9]/g, ''), 10) || 1));
    const parentName = row[parentIdx]?.trim();
    const parentId = depth > 1
      ? (parentName ? [...items].reverse().find(item => item.thngNm === parentName)?.id : latestByDepth.get(depth - 1))
      : undefined;
    const item = {
      id: genId(),
      budgetCategory: category,
      thngNm,
      thngCd: row[codeIdx]?.trim() || '',
      spec: row[specIdx]?.trim() || '',
      unitPrice,
      quantity,
      subtotal: amount > 0 ? amount : unitPrice * quantity,
      parentId,
    };
    items.push(item);
    latestByDepth.set(depth, item.id);
    for (const key of Array.from(latestByDepth.keys())) {
      if (key > depth) latestByDepth.delete(key);
    }
  }

  if (items.length === 0) throw new Error('불러올 품목 행이 없습니다.');
  return { items, totalBudget };
}

function sortItemsByCategory(items: BudgetItem[]): BudgetItem[] {
  const childrenByParent = new Map<string, BudgetItem[]>();
  for (const item of items) {
    if (!item.parentId) continue;
    childrenByParent.set(item.parentId, [...(childrenByParent.get(item.parentId) ?? []), item]);
  }
  const roots = items.filter(item => !item.parentId).sort((a, b) => {
    const categoryDiff = CATEGORIES.indexOf(a.budgetCategory) - CATEGORIES.indexOf(b.budgetCategory);
    if (categoryDiff !== 0) return categoryDiff;
    if (a.memo === AUTO_BALANCE_MEMO && b.memo !== AUTO_BALANCE_MEMO) return 1;
    if (a.memo !== AUTO_BALANCE_MEMO && b.memo === AUTO_BALANCE_MEMO) return -1;
    return 0;
  });
  const append = (item: BudgetItem): BudgetItem[] => [
    item,
    ...(childrenByParent.get(item.id) ?? []).flatMap(child => append(child)),
  ];
  return roots.flatMap(item => append(item));
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

function groupGeneratedBudgetItems(items: BudgetItem[], keywordMap: Record<BudgetCategory, string>): BudgetItem[] {
  if (parentIdsWithChildren(items).size > 0) return sortItemsByCategory(items);
  const groupedRows: BudgetItem[] = [];

  for (const category of CATEGORIES) {
    const categoryItems = items.filter(item => item.budgetCategory === category);
    if (categoryItems.length === 0) continue;
    const desiredGroups = splitDesiredItems(keywordMap[category]).filter(word => !isExcludedAutoItemName(word));
    const fallbackGroup = category === '교육운영비' ? '교육활동 운영' : category === '일반운영비' ? '학교 운영 지원' : '업무추진 운영';
    const groups = new Map<string, BudgetItem[]>();

    for (const item of categoryItems) {
      const text = `${item.thngNm} ${item.spec ?? ''}`.replace(/\s/g, '');
      const groupName = desiredGroups.find(word => {
        const normalized = word.replace(/\s/g, '');
        return text.includes(normalized) || normalized.includes(text);
      }) ?? desiredGroups[0] ?? fallbackGroup;
      groups.set(groupName, [...(groups.get(groupName) ?? []), item]);
    }

    for (const [groupName, rows] of groups) {
      const parent = makeItem(category, { thngNm: groupName, spec: '하위항목 합계', thngCd: 'generated-parent', priceSource: '자동 구성' });
      const detail = makeItem(category, { thngNm: `${groupName} 산출내역`, spec: '하위항목 합계', thngCd: 'generated-detail', priceSource: '자동 구성' });
      detail.parentId = parent.id;
      groupedRows.push(parent, detail);
      for (const row of rows) {
        groupedRows.push({
          ...row,
          id: genId(),
          parentId: detail.id,
          budgetCategory: category,
          subtotal: calcSubtotal(row),
        });
      }
    }
  }

  return groupedRows;
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
  const trimmed = text.trim();
  const jsonText = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim()
    ?? trimmed.slice(trimmed.indexOf('['), trimmed.lastIndexOf(']') + 1);
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) throw new Error('AI 응답 형식이 올바르지 않습니다.');
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
    candidates[category] = [
      ...desiredItems,
      ...LOCAL_CATALOG[category].filter(item => words.some(word => item.thngNm.includes(word) || item.spec?.includes(word))),
      ...candidates[category],
      ...LOCAL_CATALOG[category],
    ];
  }
  return candidates;
}

function balanceItemsByCategory(items: BudgetItem[], allocations: Record<BudgetCategory, number>): BudgetItem[] {
  const userItems = items
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
      .sort((a, b) => b.unitPrice - a.unitPrice);

    let diff = allocations[category] - used;
    if (diff < 0) {
      for (const item of categoryItems) {
        const minQuantity = Math.max(1, item.minQuantity || 1);
        const removable = Math.max(0, item.quantity - minQuantity);
        if (removable <= 0) continue;
        const over = used - allocations[category];
        const removeQuantity = Math.min(removable, Math.floor(over / item.unitPrice));
        const shouldRemoveOne = removeQuantity === 0 && Math.abs(over - item.unitPrice) < over;
        const quantityToRemove = shouldRemoveOne ? 1 : removeQuantity;
        if (quantityToRemove <= 0) continue;
        item.quantity -= quantityToRemove;
        item.subtotal = calcSubtotal(item);
        item.quantityAdjusted = true;
        used -= quantityToRemove * item.unitPrice;
        if (used <= allocations[category]) break;
      }
    }

    diff = allocations[category] - used;
    if (diff > 0) {
      for (const item of categoryItems) {
        const maxExtraQuantity = item.maxQuantity && item.maxQuantity > item.quantity
          ? item.maxQuantity - item.quantity
          : Math.floor(diff / item.unitPrice);
        const extraQuantity = Math.min(Math.floor(diff / item.unitPrice), maxExtraQuantity);
        if (extraQuantity <= 0) continue;
        item.quantity += extraQuantity;
        item.subtotal = calcSubtotal(item);
        item.quantityAdjusted = true;
        used += extraQuantity * item.unitPrice;
        diff = allocations[category] - used;
        if (diff <= 0) break;
      }
    }

    let improved = true;
    while (improved) {
      improved = false;
      const currentGap = Math.abs(allocations[category] - used);
      let bestItem: BudgetItem | null = null;
      let bestDelta = 0;
      let bestGap = currentGap;

      for (const item of categoryItems) {
        const minQuantity = Math.max(1, item.minQuantity || 1);
        const maxQuantity = item.maxQuantity && item.maxQuantity >= minQuantity ? item.maxQuantity : undefined;
        const candidates: Array<1 | -1> = [];
        if (!maxQuantity || item.quantity < maxQuantity) candidates.push(1);
        if (item.quantity > minQuantity) candidates.push(-1);

        for (const delta of candidates) {
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
        improved = true;
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

export default function BudgetPlannerScreen() {
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [activePlan, setActivePlan] = useState<BudgetPlan | null>(null);
  const [totalBudget, setTotalBudget] = useState(DEFAULT_BUDGET_TOTAL);
  const [planTitle, setPlanTitle] = useState(DEFAULT_BUDGET_TITLE);

  const [apiKey, setApiKey] = useState('');
  const [naverClientId, setNaverClientId] = useState('');
  const [naverClientSecret, setNaverClientSecret] = useState('');
  const [showPriceSettings, setShowPriceSettings] = useState(false);
  const [showApiGuide, setShowApiGuide] = useState(false);
  const [apiGuideStep, setApiGuideStep] = useState(1);
  const [internetPriceTestMessage, setInternetPriceTestMessage] = useState('');
  const [isTestingInternetPrice, setIsTestingInternetPrice] = useState(false);

  const [ratioEdu, setRatioEdu] = useState('75');
  const [ratioGeneral, setRatioGeneral] = useState('20');
  const [ratioBiz, setRatioBiz] = useState('5');
  const [keywordEdu, setKeywordEdu] = useState(CATEGORY_KEYWORDS.교육운영비.join(', '));
  const [keywordGeneral, setKeywordGeneral] = useState(CATEGORY_KEYWORDS.일반운영비.join(', '));
  const [keywordBiz, setKeywordBiz] = useState(CATEGORY_KEYWORDS.업무추진비.join(', '));

  const [showRatio, setShowRatio] = useState(true);
  const [recommendationStatus, setRecommendationStatus] = useState<RecommendationStatus>('idle');
  const [recommendationMessage, setRecommendationMessage] = useState('');

  useEffect(() => {
    window.electronAPI.getConfig('naramarketApiKey').then((key: unknown) => {
      if (typeof key === 'string') setApiKey(key);
    }).catch(() => {});
    window.electronAPI.getConfig('naverShoppingClientId').then((key: unknown) => {
      if (typeof key === 'string') setNaverClientId(key);
    }).catch(() => {});
    window.electronAPI.getConfig('naverShoppingClientSecret').then((key: unknown) => {
      if (typeof key === 'string') setNaverClientSecret(key);
    }).catch(() => {});
    window.electronAPI.readJsonData('budget-plans').then((data: unknown) => {
      if (Array.isArray(data)) setPlans((data as BudgetPlan[]).map(normalizeBudgetPlan));
    }).catch(() => {});
  }, []);

  const ratioTotal = (parseInt(ratioEdu) || 0) + (parseInt(ratioGeneral) || 0) + (parseInt(ratioBiz) || 0);
  const budgetForCalc = activePlan?.totalBudget ?? parseMoney(totalBudget);
  const allocEdu = ratioTotal > 0 ? Math.round(budgetForCalc * (parseInt(ratioEdu) || 0) / ratioTotal) : 0;
  const allocGeneral = ratioTotal > 0 ? Math.round(budgetForCalc * (parseInt(ratioGeneral) || 0) / ratioTotal) : 0;
  const allocBiz = Math.max(0, budgetForCalc - allocEdu - allocGeneral);
  const allocations: Record<BudgetCategory, number> = {
    교육운영비: allocEdu,
    일반운영비: allocGeneral,
    업무추진비: allocBiz,
  };

  const countablePlanItems = useMemo(() => countableItems(activePlan?.items ?? []), [activePlan]);
  const planTotalUsed = countablePlanItems.reduce((sum, item) => sum + item.subtotal, 0);
  const planRemaining = (activePlan?.totalBudget ?? 0) - planTotalUsed;

  const usedByCategory = useMemo(() => {
    const used: Record<BudgetCategory, number> = { 교육운영비: 0, 일반운영비: 0, 업무추진비: 0 };
    for (const item of countableItems(activePlan?.items ?? [])) used[item.budgetCategory] += item.subtotal;
    return used;
  }, [activePlan]);

  const keywordMap: Record<BudgetCategory, string> = {
    교육운영비: keywordEdu,
    일반운영비: keywordGeneral,
    업무추진비: keywordBiz,
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

  const saveApiKey = async () => {
    setApiKey(apiKey.trim());
    setNaverClientId(naverClientId.trim());
    setNaverClientSecret(naverClientSecret.trim());
    await window.electronAPI.setConfig({
      naramarketApiKey: apiKey.trim(),
      naverShoppingClientId: naverClientId.trim(),
      naverShoppingClientSecret: naverClientSecret.trim(),
    });
  };

  const testInternetPriceSearch = async () => {
    const clientId = naverClientId.trim();
    const clientSecret = naverClientSecret.trim();
    if (!clientId || !clientSecret) {
      setInternetPriceTestMessage('Client ID와 Client Secret을 모두 입력해주세요.');
      return;
    }
    setIsTestingInternetPrice(true);
    setInternetPriceTestMessage('');
    try {
      await saveApiKey();
      const data = await window.electronAPI.naverShoppingSearch('복사용지', clientId, clientSecret);
      const rows = normalizeNaverShoppingItems(data);
      setInternetPriceTestMessage(rows.length > 0
        ? `인터넷 가격조회 연결됨 · 복사용지 ${rows.length}건 확인`
        : '연결은 되었지만 복사용지 검색 결과가 없습니다. 검색 API 권한을 확인해주세요.');
    } catch (e: any) {
      setInternetPriceTestMessage(e?.message ?? '인터넷 가격조회 테스트 중 오류가 발생했습니다.');
    } finally {
      setIsTestingInternetPrice(false);
    }
  };

  const handleNewPlan = () => {
    const budget = parseMoney(totalBudget);
    if (!planTitle.trim() || budget <= 0) return;
    setActivePlan({
      id: genId(),
      title: planTitle.trim(),
      totalBudget: budget,
      items: planTitle.trim() === DEFAULT_BUDGET_TITLE && budget === parseMoney(DEFAULT_BUDGET_TOTAL) ? buildExampleBudgetItems() : [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setRecommendationStatus('idle');
    setRecommendationMessage('');
  };

  const updatePlanItems = (items: BudgetItem[]) => {
    if (!activePlan) return;
    setActivePlan({ ...activePlan, items, updatedAt: Date.now() });
  };

  const addItemToPlan = (item?: Partial<NaraItem>, category: BudgetCategory = '교육운영비') => {
    if (!activePlan) return;
    updatePlanItems([...activePlan.items, makeItem(category, item)]);
  };

  const addChildItemToPlan = (parentId: string) => {
    if (!activePlan) return;
    const parent = activePlan.items.find(item => item.id === parentId);
    if (!parent) return;
    const parentDepth = getItemDepth(activePlan.items, parent);
    if (parentDepth >= MAX_BUDGET_DEPTH) return;
    const child = makeItem(parent.budgetCategory, { thngNm: '', spec: parentDepth === 1 ? '하위항목 합계' : '직접 입력' });
    child.parentId = parentId;
    const descendants = collectDescendantIds(activePlan.items, parentId);
    const insertAt = activePlan.items.reduce((last, item, index) => item.id === parentId || descendants.has(item.id) ? index + 1 : last, 0);
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

  const collectBudgetCandidates = async (): Promise<Record<BudgetCategory, NaraItem[]>> => {
    const localCandidates = buildLocalCandidates(activePlan?.title ?? planTitle, keywordMap);
    const titleKeywords = getTitleKeywords(activePlan?.title ?? planTitle);
    const candidates: Record<BudgetCategory, NaraItem[]> = {
      교육운영비: [...localCandidates.교육운영비],
      일반운영비: [...localCandidates.일반운영비],
      업무추진비: [...localCandidates.업무추진비],
    };

    const hasNaraKey = !!apiKey.trim();
    const hasNaverKey = !!naverClientId.trim() && !!naverClientSecret.trim();
    if (!hasNaraKey && !hasNaverKey) return candidates;
    for (const category of CATEGORIES) {
      const explicitWords = splitDesiredItems(keywordMap[category]);
      const keywords = Array.from(new Set([
        ...expandDesiredWords(explicitWords),
        ...(explicitWords.length > 0 ? [] : (titleKeywords[category] ?? [])),
      ])).slice(0, 6);
      for (const keyword of keywords) {
        if (hasNaverKey) {
          try {
            const data = await window.electronAPI.naverShoppingSearch(keyword, naverClientId, naverClientSecret);
            candidates[category].push(...normalizeNaverShoppingItems(data));
          } catch {
            // Internet reference prices are optional.
          }
        }
        try {
          if (hasNaraKey) {
            const data = await window.electronAPI.naramarketShoppingSearch(keyword, apiKey);
            candidates[category].unshift(...normalizeApiItems(data, true));
          }
        } catch {
          // API 결과가 없어도 내장 후보로 예산안을 계속 만듭니다.
        }
      }
    }
    return candidates;
  };

  const makeAiBudgetPlan = async (candidates: Record<BudgetCategory, NaraItem[]>): Promise<BudgetItem[]> => {
    const titleKeywords = getTitleKeywords(activePlan?.title ?? planTitle);
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
      '예산 제목과 구입 희망 물품의 성격을 분석해 어울리는 품목을 고르고, 과목별 배정액에 가깝게 맞춰.',
      '강사비, 원고비, 수수료, 임차료, 홍보물, 현수막, 사무·운영성 라이선스는 일반운영비로 분류해.',
      '학생이 직접 쓰는 교육활동 물품, 학생 간식, 학생 기념품, 체험·행사 운영 물품은 교육운영비로 분류해.',
      '업무추진비는 협의회나 사업 추진을 위한 식비와 다과비처럼 업무추진 목적이 분명할 때만 사용해.',
      '상품권, 문화상품권, 기프트카드, 모바일 쿠폰, 기프티콘은 자동 생성하지 마. 학생 보상성 항목은 간식, 기념품, 체험 물품, 학습 활동 물품으로 대체해.',
      '예산 제목에 특정 품목이나 활동명이 있으면 그 품목·활동과 직접 관련된 품목만 사용해.',
      '예산 제목과 직접 관련 없는 기본 사무용품, 다과, 청소용품, 도서 등을 끼워 넣지 마.',
      '후보 품목이 있으면 후보 단가를 우선 사용하고, 부족하면 같은 성격의 품목만 직접 제안해.',
      '전체 예산과 과목별 배정액을 초과하지 않는 방향으로 6~18개 행을 만들어.',
      '사용자가 과목별로 입력한 구입 물품이 있으면 그 입력을 최우선으로 반영해.',
      '입력한 물품이 넓은 표현이면 같은 목적의 구체 품목으로만 확장해. 예: 에듀테크는 태블릿, 스마트기기, 코딩교구 / 다과와 식비는 간식, 음료, 도시락.',
      '입력한 물품과 무관한 기본 사무용품이나 다른 과목 물품을 예산 맞추기용으로 섞지 마.',
      JSON.stringify({
        title: activePlan?.title ?? planTitle,
        totalBudget: budgetForCalc,
        allocations,
        titleKeywords,
        desiredItems: keywordMap,
        excludedAutoItems: EXCLUDED_AUTO_ITEM_WORDS,
        candidateItems: candidateSummary,
      }, null, 2),
    ].join('\n');
    const systemInstruction = '너는 한국 학교 예산사용계획을 작성하는 행정 보조자다. 사용자가 바로 수정하고 CSV로 내려받을 수 있는 품목표만 만든다.';
    const text = await window.electronAPI.aiGenerate(prompt, systemInstruction, { temperature: 0.4 });
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
      priceSource: 'AI 추정',
    }));
    const desiredItems = filterItemsByDesiredIntent(aiItems, keywordMap);
    return Object.values(keywordMap).some(value => splitDesiredItems(value).length > 0)
      ? desiredItems
      : filterItemsByTitleIntent(desiredItems, activePlan?.title ?? planTitle);
  };

  const makeRecommendations = async (): Promise<{ items: BudgetItem[]; source: 'ai' | 'local' }> => {
    if (budgetForCalc <= 0) throw new Error('예산을 먼저 입력해주세요.');

    const candidates = await collectBudgetCandidates();
    try {
      const aiItems = await makeAiBudgetPlan(candidates);
      return { items: balanceItemsByCategory(aiItems, allocations), source: 'ai' };
    } catch {
      const desiredFallback = filterItemsByDesiredIntent(buildRecommendation(candidates, allocations), keywordMap);
      const fallback = Object.values(keywordMap).some(value => splitDesiredItems(value).length > 0)
        ? desiredFallback
        : filterItemsByTitleIntent(desiredFallback, activePlan?.title ?? planTitle);
      if (fallback.length === 0) throw new Error('예산안 품목을 만들지 못했습니다. Gemini API 키, 예산 금액, 과목별 비율을 확인해주세요.');
      return { items: balanceItemsByCategory(fallback, allocations), source: 'local' };
    }
  };

  const handleMakeRecommendations = async () => {
    if (!activePlan) return;
    setRecommendationStatus('loading');
    setRecommendationMessage('');
    try {
      const { items: next, source } = await makeRecommendations();
      const grouped = groupGeneratedBudgetItems(next, keywordMap);
      setRecommendationStatus('ready');
      setActivePlan({ ...activePlan, items: grouped, updatedAt: Date.now() });
      setRecommendationMessage(source === 'ai'
        ? `Gemini가 예산 성격을 분석해 3단계 예산안 ${grouped.length}개 행을 만들었습니다.`
        : `Gemini 호출이 어려워 내장 후보로 3단계 예산안 ${grouped.length}개 행을 만들었습니다.`);
    } catch (e: any) {
      setRecommendationStatus('error');
      setRecommendationMessage(e?.message ?? '예산안을 만들지 못했습니다.');
    }
  };

  const autoBalancePlan = () => {
    if (!activePlan || activePlan.items.length === 0) return;
    const balancedItems = balanceItemsByCategory(activePlan.items, allocations);
    updatePlanItems(balancedItems);
    const overCategories = CATEGORIES.filter(category => {
      const used = countableItems(activePlan.items)
        .filter(item => item.memo !== AUTO_BALANCE_MEMO && item.budgetCategory === category)
        .reduce((sum, item) => sum + item.subtotal, 0);
      return used > allocations[category];
    });
    setRecommendationStatus('ready');
    setRecommendationMessage(overCategories.length > 0
      ? `사용자가 수정한 행은 유지했습니다. ${overCategories.join(', ')}는 배정액을 초과해 직접 조정이 필요합니다.`
      : '사용자가 수정한 행을 유지하고, 부족한 금액만 자동 조정 행으로 맞췄습니다.');
  };

  const handleSave = async () => {
    if (!activePlan) return;
    const exists = plans.some(plan => plan.id === activePlan.id);
    await savePlans(exists ? plans.map(plan => plan.id === activePlan.id ? activePlan : plan) : [...plans, activePlan]);
  };

  const handleExportCsv = async () => {
    if (!activePlan) return;
    const rows = [
      ['순', '단계', '상위항목', '예산 과목', '품목', '품목코드', '규격', '단가(원)', '수량', '소계(원)'],
      ...activePlan.items.map((item, idx) => [
        String(idx + 1),
        String(getItemDepth(activePlan.items, item)),
        item.parentId ? activePlan.items.find(parent => parent.id === item.parentId)?.thngNm ?? '' : '',
        item.budgetCategory,
        item.thngNm,
        item.thngCd ?? '',
        item.spec ?? '',
        String(item.unitPrice),
        String(item.quantity),
        String(displaySubtotal(item, activePlan.items)),
        item.priceSource ?? '',
      ]),
      ['', '', '', '', '', '', '합계', '', '', String(planTotalUsed)],
      ['', '', '', '', '', '', '배정 예산', '', '', String(activePlan.totalBudget)],
      ['', '', '', '', '', '', '잔액', '', '', String(planRemaining)],
    ];
    const csv = rows.map(row => row.map(col => `"${String(col).replace(/"/g, '""')}"`).join(',')).join('\n');
    await window.electronAPI.saveCsv(csv, `${activePlan.title}_예산사용계획`);
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
    { title: '나라장터 키 발급', desc: '공공데이터포털에서 물품목록정보서비스와 종합쇼핑몰 품목정보 서비스를 활용신청합니다.', action: { label: 'data.go.kr 열기', url: 'https://www.data.go.kr' } },
    { title: '인터넷 가격 조회 신청', desc: '개발자 센터에 로그인한 뒤 애플리케이션 등록 화면에서 새 애플리케이션을 만듭니다.', action: { label: '개발자 센터 열기', url: 'https://developers.naver.com' } },
    { title: '쇼핑 검색 API 선택', desc: '사용 API 항목에서 검색 API를 선택하고, 세부 항목에서 쇼핑 검색을 사용할 수 있게 설정합니다.' },
    { title: '사용 환경 입력', desc: '앱 이름은 EduNote처럼 알아보기 쉽게 입력하고, 사용 환경은 PC 프로그램 또는 웹 서비스 항목 중 제공되는 방식에 맞춰 등록합니다.' },
    { title: '키 복사', desc: '등록이 끝나면 애플리케이션 정보 화면에서 Client ID와 Client Secret을 각각 복사합니다.' },
    { title: '키 저장', desc: '아래 입력칸에 인터넷 가격 조회 Client ID와 Client Secret을 붙여넣고 저장합니다. 저장하면 앱을 껐다 켜도 유지됩니다.' },
    { title: '단가 적용 방식', desc: '나라장터 계약단가를 우선 사용하고, 없을 때 인터넷 참고가와 AI 추정 단가를 보조로 사용합니다.' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA] dark:bg-gray-900">
      <div className="shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3 flex items-center gap-3">
        <h1 className="text-base font-black text-gray-900 dark:text-white">예산사용계획</h1>
        <span className="text-xs text-gray-400">나라장터 품목으로 예산을 0원에 가깝게 맞추기</span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
          <section className="p-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">가격 조회 정보 선택 입력</span>
              <button onClick={() => setShowPriceSettings(v => !v)} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                {showPriceSettings ? '닫기' : '열기'} {showPriceSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
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
                      className={`w-6 h-6 rounded-full text-[10px] font-bold ${apiGuideStep === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
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
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="인증키 붙여넣기" className={inputCls} />
              <button onClick={saveApiKey} className={`${btnCls} bg-blue-600 text-white hover:bg-blue-700 shrink-0`}>나라장터 키 저장</button>
            </div>
            {apiKey && <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> API 키 설정됨</p>}
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
              나라장터 API 키와 인터넷 가격조회 Client 정보는 선택 입력입니다. 입력하지 않아도 예산안은 만들 수 있고, 입력하면 실제 검색 단가를 참고합니다.
            </p>
          <div className="pt-3">
            <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">인터넷 가격조회 Client 정보 (선택)</p>
            <div className="space-y-2">
              <input type="password" value={naverClientId} onChange={e => setNaverClientId(e.target.value)} placeholder="인터넷 가격 조회 Client ID" className={inputCls} />
              <input type="password" value={naverClientSecret} onChange={e => setNaverClientSecret(e.target.value)} placeholder="인터넷 가격 조회 Client Secret" className={inputCls} />
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={saveApiKey} className={`${btnCls} bg-slate-600 text-white hover:bg-slate-700 flex-1`}>
                <Save className="w-3.5 h-3.5 inline mr-1" />인터넷 키 저장
              </button>
              <button onClick={testInternetPriceSearch} disabled={isTestingInternetPrice} className={`${btnCls} bg-blue-600 text-white hover:bg-blue-700 flex-1`}>
                {isTestingInternetPrice ? <RefreshCw className="w-3.5 h-3.5 inline mr-1 animate-spin" /> : <Search className="w-3.5 h-3.5 inline mr-1" />}
                테스트 조회
              </button>
            </div>
            {(naverClientId && naverClientSecret) && <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 인터넷 가격 조회 키 설정됨</p>}
            {internetPriceTestMessage && (
              <p className={`text-xs mt-1 flex items-start gap-1 ${internetPriceTestMessage.includes('연결됨') ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" /> {internetPriceTestMessage}
              </p>
            )}
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              저장 후 품목 추가에서 돋보기를 누르면 나라장터 결과와 인터넷 참고가를 함께 보여줍니다.
            </p>
          </div>
              </>
            )}
          </section>

          <section className="p-4 border-b border-gray-100 dark:border-gray-700 space-y-2">
            <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">1. 예산 정보</p>
            <input value={planTitle} onChange={e => setPlanTitle(e.target.value)} placeholder="예산 제목" className={inputCls} />
            <input value={totalBudget} onChange={e => setTotalBudget(moneyInput(e.target.value))} placeholder="예산 (원)" className={inputCls} />
            <button onClick={handleNewPlan} disabled={!planTitle.trim() || !totalBudget} className={`${btnCls} w-full bg-emerald-600 text-white hover:bg-emerald-700`}>
              <Plus className="w-4 h-4 inline mr-1" />계획 시작
            </button>
          </section>

          <section className="p-4 border-b border-gray-100 dark:border-gray-700 space-y-3">
            <button onClick={() => setShowRatio(v => !v)} className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
              {showRatio ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              2. 과목별 비율과 구입하고자 하는 물품
            </button>
            {showRatio && CATEGORIES.map(category => (
              <div key={category} className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-20 text-xs font-bold text-gray-700 dark:text-gray-300">{category}</span>
                  <input
                    type="number"
                    min={0}
                    value={category === '교육운영비' ? ratioEdu : category === '일반운영비' ? ratioGeneral : ratioBiz}
                    onChange={e => category === '교육운영비' ? setRatioEdu(e.target.value) : category === '일반운영비' ? setRatioGeneral(e.target.value) : setRatioBiz(e.target.value)}
                    className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                  />
                  <span className="text-xs text-gray-500">% · {fmt(allocations[category])}원</span>
                </div>
                <input value={keywordMap[category]} onChange={e => setKeywordMap[category](e.target.value)} placeholder="구입 물품을 쉼표로 구분" className={inputCls} />
              </div>
            ))}
          </section>

          {plans.length > 0 && (
            <section className="p-4 border-b border-gray-100 dark:border-gray-700">
              <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">저장된 계획</p>
              <div className="space-y-1">
                {plans.map(plan => (
                  <button key={plan.id} onClick={() => { const normalized = normalizeBudgetPlan(plan); setActivePlan(normalized); setTotalBudget(fmt(normalized.totalBudget)); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs ${activePlan?.id === plan.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                    <p className="font-semibold truncate">{plan.title}</p>
                    <p className="text-gray-400">{fmt(plan.totalBudget)}원</p>
                  </button>
                ))}
              </div>
            </section>
          )}

        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          {!activePlan ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-4xl mb-3">💰</p>
                <p className="font-bold">예산 제목과 예산을 입력한 뒤 계획을 시작하세요</p>
              </div>
            </div>
          ) : (
            <>
              <header className="shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-gray-900 dark:text-white">{activePlan.title}</h2>
                    <p className="text-xs text-gray-500">배정 예산: {fmt(activePlan.totalBudget)}원</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button onClick={handleMakeRecommendations} disabled={recommendationStatus === 'loading'} className={`${btnCls} bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1`}>
                      <Wand2 className="w-3.5 h-3.5" />예산안 만들기
                    </button>
                    <button onClick={autoBalancePlan} className={`${btnCls} bg-gray-700 text-white hover:bg-gray-800 flex items-center gap-1`}>
                      자동 비율 및 0원 맞추기
                    </button>
                    <button onClick={() => window.electronAPI.openExternal(BUDGET_NOTEBOOK_LM_URL)} className={`${btnCls} bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 flex items-center gap-1`}>
                      <ExternalLink className="w-3.5 h-3.5" />예산 질문하기
                    </button>
                    <button onClick={handleSave} className={`${btnCls} bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1`}>
                      <Save className="w-3.5 h-3.5" />저장
                    </button>
                    <button onClick={handleImportCsv} className={`${btnCls} bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 flex items-center gap-1`}>
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
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-black text-gray-800 dark:text-gray-100">예산안</h3>
                    <button onClick={() => addItemToPlan()} className={`${btnCls} bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 flex items-center gap-1`}>
                      <Plus className="w-3.5 h-3.5" />행 추가
                    </button>
                  </div>
                  <EditableBudgetTable
                    items={activePlan.items}
                    emptyText="예산안 만들기를 누르거나 왼쪽에서 품목을 추가하세요"
                    totalBudget={activePlan.totalBudget}
                    usedTotal={planTotalUsed}
                    remaining={planRemaining}
                    allocations={allocations}
                    usedByCategory={usedByCategory}
                    onChange={(id, patch) => updatePlanItems(updateRows(activePlan.items, id, patch))}
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
      thngCd: row.prdctIdntNo || row.prdctNo || '',
      spec: row.itemSpec || row.prdctSpecNm || row.stdUntNm || row.prdctClsfcNoNm || row.dtilPrdctClsfcNoNm || '',
      mnfctCorpNm: row.cntrctCorpNm || row.mnfctCorpNm || row.mnfctCmpyNm || '',
      unitPrice: preferPrice ? unitPrice : undefined,
      priceSource: preferPrice && unitPrice ? '나라장터 계약단가' : '나라장터 품목목록',
    };
  });
}

function normalizeNaverShoppingItems(data: any): NaraItem[] {
  const rows = Array.isArray(data?.items) ? data.items : [];
  return rows.map((row: any) => {
    const unitPrice = Number(row.lprice ?? row.lowPrice ?? row.price ?? 0) || undefined;
    const title = String(row.title ?? '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
    return {
      thngNm: title || '(이름 없음)',
      thngCd: row.productId ? `internet-${row.productId}` : `internet-${title}`,
      spec: row.mallName ? `인터넷 참고가 · ${row.mallName}` : '인터넷 참고가',
      mnfctCorpNm: row.maker || row.brand || row.mallName || '',
      unitPrice,
      priceSource: '인터넷 참고가',
      priceSourceUrl: row.link || '',
    };
  }).filter((item: NaraItem) => item.thngNm && (item.unitPrice ?? 0) > 0);
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
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">집행: {fmt(used)}원</span>
        <span className={`font-bold ${remaining === 0 ? 'text-green-600' : remaining < 0 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
          {remaining === 0 ? '잔액 0원 달성' : remaining > 0 ? `잔액 ${fmt(remaining)}원` : `초과 ${fmt(Math.abs(remaining))}원`}
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${remaining < 0 ? 'bg-red-500' : remaining === 0 ? 'bg-green-500' : 'bg-blue-500'}`}
          style={{ width: `${total > 0 ? Math.min(100, (used / total) * 100) : 0}%` }}
        />
      </div>
    </div>
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
  onChange: (id: string, patch: Partial<Pick<BudgetItem, 'budgetCategory' | 'thngNm' | 'unitPrice' | 'quantity' | 'minQuantity' | 'maxQuantity' | 'spec'>>) => void;
  onAddChild: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="h-28 flex items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 text-sm">
        {emptyText}
      </div>
    );
  }

  const parentIds = parentIdsWithChildren(items);

  return (
    <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center w-8">순</th>
            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-28">예산 과목</th>
            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 min-w-52">품목</th>
            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 min-w-40">규격</th>
            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-28 text-right">단가</th>
            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-20 text-center">최소</th>
            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-20 text-center">수량</th>
            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-20 text-center">최대</th>
            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-32 text-right">소계</th>
            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const categoryColor = CATEGORY_COLORS[item.budgetCategory];
            const adjustedCellClass = item.quantityAdjusted ? 'bg-amber-100 dark:bg-amber-900/40 ring-1 ring-amber-300 dark:ring-amber-600' : '';
            const isParent = parentIds.has(item.id);
            const depth = getItemDepth(items, item);
            const canAddChild = depth < MAX_BUDGET_DEPTH;
            const depthLabel = depth === 1 ? '부모항목' : depth === 2 ? '하위항목' : '산출내역';
            const indentClass = depth === 1 ? '' : depth === 2 ? 'pl-5' : 'pl-9';
            const rowWeight = isParent ? 'font-semibold' : '';
            return (
            <tr key={item.id} className={`${categoryColor.row} ${depth > 1 ? 'border-l-4 border-l-blue-300 dark:border-l-blue-700' : ''} ${isParent ? 'bg-opacity-90' : ''}`}>
              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-center text-gray-500">{idx + 1}</td>
              <td className={`border border-gray-200 dark:border-gray-700 px-2 py-1.5 ${categoryColor.cell}`}>
                <select value={item.budgetCategory} onChange={e => onChange(item.id, { budgetCategory: e.target.value as BudgetCategory })}
                  disabled={depth > 1}
                  className={`w-full text-xs border-none rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-70 ${categoryColor.select}`}>
                  {CATEGORIES.map(category => <option key={category}>{category}</option>)}
                </select>
              </td>
              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                <div className={indentClass}>
                <div className="flex items-center gap-1 text-[10px] font-semibold text-blue-500 dark:text-blue-300">
                  {isParent && <ChevronDown className="w-3 h-3" />}
                  {depth > 1 && <span className="text-gray-400">└</span>}
                  <span>{depthLabel}</span>
                </div>
                <input value={item.thngNm} onChange={e => onChange(item.id, { thngNm: e.target.value })}
                  placeholder="품목명" className={`w-full text-xs bg-transparent border-none focus:outline-none text-gray-800 dark:text-gray-100 focus:ring-1 focus:ring-blue-400 rounded px-1 ${rowWeight}`} />
                {item.priceSource && <div className="mt-0.5 px-1 text-[10px] text-gray-500 dark:text-gray-400">{item.priceSource}</div>}
                {canAddChild && (
                  <button onClick={() => onAddChild(item.id)} className="mt-1 text-[10px] font-semibold text-blue-600 dark:text-blue-300 hover:underline">
                    + {depth === 1 ? '하위항목' : '산출내역'} 추가
                  </button>
                )}
                {isParent && <div className="mt-0.5 px-1 text-[10px] text-gray-500 dark:text-gray-400">하위항목 합계로 표시, 중복 집계 안 함</div>}
                {!canAddChild && <div className="mt-0.5 px-1 text-[10px] text-gray-400">3단계 산출내역</div>}
                </div>
              </td>
              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                <input value={item.spec ?? ''} onChange={e => onChange(item.id, { spec: e.target.value })}
                  placeholder="규격" className="w-full text-xs bg-transparent border-none focus:outline-none text-gray-500 dark:text-gray-300 focus:ring-1 focus:ring-blue-400 rounded px-1" />
              </td>
              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                <input type="number" min={0} value={item.unitPrice}
                  onChange={e => onChange(item.id, { unitPrice: parseInt(e.target.value, 10) || 0 })}
                  disabled={isParent}
                  className="w-full text-right text-xs bg-transparent border-none focus:outline-none text-gray-800 dark:text-gray-100 focus:ring-1 focus:ring-blue-400 rounded px-1 disabled:text-gray-400" />
                {item.unitPriceLocked && <div className="mt-0.5 text-[10px] text-gray-500 text-right">고정</div>}
              </td>
              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                <input type="number" min={1} value={item.minQuantity ?? ''}
                  onChange={e => onChange(item.id, { minQuantity: e.target.value ? parseInt(e.target.value, 10) || 1 : undefined })}
                  disabled={isParent}
                  className="w-full text-center text-xs bg-transparent border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-800 dark:text-gray-100 disabled:text-gray-400" />
              </td>
              <td className={`border border-gray-200 dark:border-gray-700 px-2 py-1.5 ${adjustedCellClass}`}>
                <input type="number" min={1} value={item.quantity}
                  onChange={e => onChange(item.id, { quantity: parseInt(e.target.value, 10) || 1 })}
                  disabled={isParent}
                  className="w-full text-center text-xs bg-transparent border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-800 dark:text-gray-100 disabled:text-gray-400" />
                {item.quantityLocked && <div className="mt-0.5 text-[10px] text-gray-500 text-center">고정</div>}
                {item.quantityAdjusted && <div className="mt-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 text-center">자동 조정</div>}
              </td>
              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                <input type="number" min={item.minQuantity ?? 1} value={item.maxQuantity ?? ''}
                  onChange={e => onChange(item.id, { maxQuantity: e.target.value ? parseInt(e.target.value, 10) || undefined : undefined })}
                  disabled={isParent}
                  className="w-full text-center text-xs bg-transparent border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-800 dark:text-gray-100 disabled:text-gray-400" />
              </td>
              <td className={`border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-right font-semibold text-gray-800 dark:text-gray-100 text-xs ${adjustedCellClass}`}>
                {fmt(displaySubtotal(item, items))}
              </td>
              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-center">
                <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600" title="행 삭제">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          );
          })}
        </tbody>
        <tfoot>
          {CATEGORIES.map(category => (
            <tr key={category} className={`${CATEGORY_COLORS[category].footer} text-xs`}>
              <td colSpan={8} className="border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-right text-gray-600 dark:text-gray-300">
                {category} 배정 {fmt(allocations[category])}원 / 집행 {fmt(usedByCategory[category])}원
              </td>
              <td className={`border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-right font-bold ${allocations[category] - usedByCategory[category] < 0 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                {fmt(allocations[category] - usedByCategory[category])}
              </td>
              <td className="border border-gray-300 dark:border-gray-600"></td>
            </tr>
          ))}
          <tr className="bg-gray-50 dark:bg-gray-700/50 font-bold text-sm">
            <td colSpan={8} className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">합계</td>
            <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-right text-blue-700 dark:text-blue-300">{fmt(usedTotal)}</td>
            <td className="border border-gray-300 dark:border-gray-600"></td>
          </tr>
          <tr className="bg-gray-50 dark:bg-gray-700/50 text-sm">
            <td colSpan={8} className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-gray-600 dark:text-gray-400">배정 예산</td>
            <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-right text-gray-700 dark:text-gray-300">{fmt(totalBudget)}</td>
            <td className="border border-gray-300 dark:border-gray-600"></td>
          </tr>
          <tr className={`text-sm font-black ${remaining === 0 ? 'bg-green-50 dark:bg-green-900/20' : remaining < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
            <td colSpan={8} className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">잔액</td>
            <td className={`border border-gray-300 dark:border-gray-600 px-2 py-2 text-right ${remaining === 0 ? 'text-green-700 dark:text-green-400' : remaining < 0 ? 'text-red-600' : 'text-amber-700 dark:text-amber-400'}`}>
              {remaining === 0 ? '0' : fmt(remaining)}
            </td>
            <td className="border border-gray-300 dark:border-gray-600"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
