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
  Wand2,
} from 'lucide-react';

const CATEGORIES: BudgetCategory[] = ['교육운영비', '일반수용비', '업무추진비'];

const CATEGORY_KEYWORDS: Record<BudgetCategory, string[]> = {
  교육운영비: ['도서', '교재', '학습지', '실험키트', '색연필', '줄넘기'],
  일반수용비: ['복사용지', '볼펜', '토너', '파일', '청소용품', '테이프'],
  업무추진비: ['커피', '음료', '과자', '차', '쿠키', '머그컵'],
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
  일반수용비: [
    { thngNm: '복사용지', thngCd: 'local-copy-paper', spec: 'A4 2500매', unitPrice: 25000 },
    { thngNm: '볼펜', thngCd: 'local-pen', spec: '12개입', unitPrice: 6000 },
    { thngNm: '클리어 파일', thngCd: 'local-clear-file', spec: '20매', unitPrice: 5000 },
    { thngNm: '바인더', thngCd: 'local-binder', spec: '개', unitPrice: 4500 },
    { thngNm: '스테이플러', thngCd: 'local-stapler', spec: '개', unitPrice: 8000 },
    { thngNm: '테이프', thngCd: 'local-tape', spec: '3개입', unitPrice: 4500 },
    { thngNm: '프린터 토너', thngCd: 'local-toner', spec: '개', unitPrice: 85000 },
    { thngNm: '청소용품 세트', thngCd: 'local-cleaning', spec: '세트', unitPrice: 18000 },
    { thngNm: '손세정제', thngCd: 'local-sanitizer', spec: '500ml', unitPrice: 7000 },
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
  학급: { 교육운영비: ['학습', '도서'], 일반수용비: ['복사용지', '파일'] },
  사무: { 일반수용비: ['복사용지', '볼펜', '파일'] },
  회의: { 업무추진비: ['커피', '차', '회의용 다과'] },
  협의: { 업무추진비: ['커피', '차', '회의용 다과'] },
};

interface NaraItem {
  thngNm: string;
  thngCd: string;
  spec?: string;
  mnfctCorpNm?: string;
  unitPrice?: number;
}

type RecommendationStatus = 'idle' | 'loading' | 'ready' | 'error';

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
  };
}

function uniqueItems(items: NaraItem[]): NaraItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.thngCd}-${item.thngNm}-${item.unitPrice}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return !!item.thngNm && (item.unitPrice ?? 0) > 0;
  });
}

function buildRecommendation(candidates: Record<BudgetCategory, NaraItem[]>, allocations: Record<BudgetCategory, number>): BudgetItem[] {
  const result: BudgetItem[] = [];
  for (const category of CATEGORIES) {
    let remaining = allocations[category];
    const priced = uniqueItems(candidates[category])
      .filter(item => (item.unitPrice ?? 0) > 0 && (item.unitPrice ?? 0) <= allocations[category])
      .sort((a, b) => (b.unitPrice ?? 0) - (a.unitPrice ?? 0));

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

function buildLocalCandidates(title: string, keywordMap: Record<BudgetCategory, string>): Record<BudgetCategory, NaraItem[]> {
  const candidates: Record<BudgetCategory, NaraItem[]> = {
    교육운영비: [...LOCAL_CATALOG.교육운영비],
    일반수용비: [...LOCAL_CATALOG.일반수용비],
    업무추진비: [...LOCAL_CATALOG.업무추진비],
  };
  const titleText = title.replace(/\s/g, '');
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
    const words = keywordMap[category].split(',').map(value => value.trim()).filter(Boolean);
    candidates[category] = [
      ...LOCAL_CATALOG[category].filter(item => words.some(word => item.thngNm.includes(word) || item.spec?.includes(word))),
      ...candidates[category],
    ];
  }
  return candidates;
}

export default function BudgetPlannerScreen() {
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [activePlan, setActivePlan] = useState<BudgetPlan | null>(null);
  const [totalBudget, setTotalBudget] = useState('');
  const [planTitle, setPlanTitle] = useState('');

  const [apiKey, setApiKey] = useState('');
  const [showApiGuide, setShowApiGuide] = useState(false);
  const [apiGuideStep, setApiGuideStep] = useState(1);

  const [ratioEdu, setRatioEdu] = useState('60');
  const [ratioGeneral, setRatioGeneral] = useState('30');
  const [ratioBiz, setRatioBiz] = useState('10');
  const [keywordEdu, setKeywordEdu] = useState(CATEGORY_KEYWORDS.교육운영비.join(', '));
  const [keywordGeneral, setKeywordGeneral] = useState(CATEGORY_KEYWORDS.일반수용비.join(', '));
  const [keywordBiz, setKeywordBiz] = useState(CATEGORY_KEYWORDS.업무추진비.join(', '));

  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory>('교육운영비');
  const [searchResults, setSearchResults] = useState<NaraItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchTarget, setSearchTarget] = useState<'plan' | 'recommendation'>('plan');

  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualCategory, setManualCategory] = useState<BudgetCategory>('교육운영비');
  const [manualTarget, setManualTarget] = useState<'plan' | 'recommendation'>('plan');

  const [showRatio, setShowRatio] = useState(true);
  const [recommendations, setRecommendations] = useState<BudgetItem[]>([]);
  const [recommendationStatus, setRecommendationStatus] = useState<RecommendationStatus>('idle');
  const [recommendationMessage, setRecommendationMessage] = useState('');

  useEffect(() => {
    window.electronAPI.getConfig('naramarketApiKey').then((key: unknown) => {
      if (typeof key === 'string') setApiKey(key);
    }).catch(() => {});
    window.electronAPI.readJsonData('budget-plans').then((data: unknown) => {
      if (Array.isArray(data)) setPlans(data as BudgetPlan[]);
    }).catch(() => {});
  }, []);

  const ratioTotal = (parseInt(ratioEdu) || 0) + (parseInt(ratioGeneral) || 0) + (parseInt(ratioBiz) || 0);
  const budgetForCalc = activePlan?.totalBudget ?? parseMoney(totalBudget);
  const allocEdu = ratioTotal > 0 ? Math.round(budgetForCalc * (parseInt(ratioEdu) || 0) / ratioTotal) : 0;
  const allocGeneral = ratioTotal > 0 ? Math.round(budgetForCalc * (parseInt(ratioGeneral) || 0) / ratioTotal) : 0;
  const allocBiz = Math.max(0, budgetForCalc - allocEdu - allocGeneral);
  const allocations: Record<BudgetCategory, number> = {
    교육운영비: allocEdu,
    일반수용비: allocGeneral,
    업무추진비: allocBiz,
  };

  const planTotalUsed = activePlan?.items.reduce((sum, item) => sum + item.subtotal, 0) ?? 0;
  const planRemaining = (activePlan?.totalBudget ?? 0) - planTotalUsed;
  const recommendationTotal = recommendations.reduce((sum, item) => sum + item.subtotal, 0);
  const recommendationRemaining = budgetForCalc - recommendationTotal;

  const usedByCategory = useMemo(() => {
    const used: Record<BudgetCategory, number> = { 교육운영비: 0, 일반수용비: 0, 업무추진비: 0 };
    for (const item of activePlan?.items ?? []) used[item.budgetCategory] += item.subtotal;
    return used;
  }, [activePlan]);

  const recommendationUsedByCategory = useMemo(() => {
    const used: Record<BudgetCategory, number> = { 교육운영비: 0, 일반수용비: 0, 업무추진비: 0 };
    for (const item of recommendations) used[item.budgetCategory] += item.subtotal;
    return used;
  }, [recommendations]);

  const keywordMap: Record<BudgetCategory, string> = {
    교육운영비: keywordEdu,
    일반수용비: keywordGeneral,
    업무추진비: keywordBiz,
  };

  const setKeywordMap: Record<BudgetCategory, React.Dispatch<React.SetStateAction<string>>> = {
    교육운영비: setKeywordEdu,
    일반수용비: setKeywordGeneral,
    업무추진비: setKeywordBiz,
  };

  const savePlans = async (updated: BudgetPlan[]) => {
    setPlans(updated);
    await window.electronAPI.writeJsonData('budget-plans', updated);
  };

  const saveApiKey = async () => {
    setApiKey(apiKey.trim());
    await window.electronAPI.setConfig({ naramarketApiKey: apiKey.trim() });
  };

  const handleNewPlan = () => {
    const budget = parseMoney(totalBudget);
    if (!planTitle.trim() || budget <= 0) return;
    setActivePlan({
      id: genId(),
      title: planTitle.trim(),
      totalBudget: budget,
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setRecommendations([]);
    setRecommendationStatus('idle');
    setRecommendationMessage('');
  };

  const updatePlanItems = (items: BudgetItem[]) => {
    if (!activePlan) return;
    setActivePlan({ ...activePlan, items, updatedAt: Date.now() });
  };

  const addItemToPlan = (item?: Partial<NaraItem>, category = selectedCategory) => {
    if (!activePlan) return;
    updatePlanItems([...activePlan.items, makeItem(category, item)]);
  };

  const addItemToRecommendations = (item?: Partial<NaraItem>, category = selectedCategory) => {
    setRecommendations(prev => [...prev, makeItem(category, item)]);
    setRecommendationStatus('ready');
  };

  const updateRows = (
    rows: BudgetItem[],
    id: string,
    patch: Partial<Pick<BudgetItem, 'budgetCategory' | 'thngNm' | 'unitPrice' | 'quantity' | 'spec'>>,
  ): BudgetItem[] => rows.map(item => {
    if (item.id !== id) return item;
    const updated = { ...item, ...patch };
    updated.quantity = Math.max(1, updated.quantity || 1);
    updated.unitPrice = Math.max(0, updated.unitPrice || 0);
    updated.subtotal = calcSubtotal(updated);
    return updated;
  });

  const handleSearch = async (keyword: string) => {
    if (!keyword.trim()) return;
    if (!apiKey.trim()) {
      setSearchError('나라장터 API 키를 설정해주세요.');
      return;
    }
    setIsSearching(true);
    setSearchError('');
    try {
      const [listData, mallData] = await Promise.all([
        window.electronAPI.naramarketSearch(keyword.trim(), apiKey),
        window.electronAPI.naramarketShoppingSearch(keyword.trim(), apiKey).catch(() => null),
      ]);
      const listRows = normalizeApiItems(listData, false);
      const mallRows = normalizeApiItems(mallData, true);
      const merged = uniqueSearchItems([...mallRows, ...listRows]);
      setSearchResults(merged);
      if (merged.length === 0) setSearchError('검색 결과가 없습니다.');
    } catch (e: any) {
      setSearchError(e?.message ?? '검색 오류');
    } finally {
      setIsSearching(false);
    }
  };

  const addSearchResult = (item: NaraItem) => {
    if (searchTarget === 'recommendation') addItemToRecommendations(item);
    else addItemToPlan(item);
  };

  const addManualItem = () => {
    if (!manualName.trim()) return;
    const item = makeItem(manualCategory, {
      thngNm: manualName.trim(),
      unitPrice: parseMoney(manualPrice),
    });
    item.quantity = Math.max(1, parseInt(manualQty, 10) || 1);
    item.subtotal = calcSubtotal(item);
    if (manualTarget === 'recommendation') setRecommendations(prev => [...prev, item]);
    else if (activePlan) updatePlanItems([...activePlan.items, item]);
    setManualName('');
    setManualPrice('');
    setManualQty('1');
  };

  const makeRecommendations = async (): Promise<BudgetItem[]> => {
    if (budgetForCalc <= 0) throw new Error('예산을 먼저 입력해주세요.');

    const localCandidates = buildLocalCandidates(activePlan?.title ?? planTitle, keywordMap);
    const candidates: Record<BudgetCategory, NaraItem[]> = {
      교육운영비: [...localCandidates.교육운영비],
      일반수용비: [...localCandidates.일반수용비],
      업무추진비: [...localCandidates.업무추진비],
    };

    if (apiKey.trim()) {
      for (const category of CATEGORIES) {
        const keywords = keywordMap[category].split(',').map(v => v.trim()).filter(Boolean).slice(0, 3);
        for (const keyword of keywords) {
          try {
            const data = await window.electronAPI.naramarketShoppingSearch(keyword, apiKey);
            candidates[category].unshift(...normalizeApiItems(data, true));
          } catch {
            // API 결과가 없어도 내장 후보로 추천안을 계속 만듭니다.
          }
        }
      }
    }

    const next = buildRecommendation(candidates, allocations);
    if (next.length === 0) throw new Error('추천 품목을 만들지 못했습니다. 예산 금액이나 과목별 비율을 확인해주세요.');
    return next;
  };

  const handleMakeRecommendations = async () => {
    setRecommendationStatus('loading');
    setRecommendationMessage('');
    try {
      const next = await makeRecommendations();
      setRecommendations(next);
      setRecommendationStatus('ready');
      setRecommendationMessage(`추천 품목 ${next.length}개를 만들었습니다.`);
    } catch (e: any) {
      setRecommendationStatus('error');
      setRecommendationMessage(e?.message ?? '추천안을 만들지 못했습니다.');
    }
  };

  const applyRecommendations = () => {
    if (!activePlan || recommendations.length === 0) return;
    const copied = recommendations.map(item => ({ ...item, id: genId() }));
    updatePlanItems(copied);
  };

  const handleInstantApply = async () => {
    if (!activePlan) return;
    setRecommendationStatus('loading');
    setRecommendationMessage('');
    try {
      const next = await makeRecommendations();
      setRecommendations(next);
      setRecommendationStatus('ready');
      setRecommendationMessage(`추천 품목 ${next.length}개를 예산안에 적용했습니다.`);
      setActivePlan({ ...activePlan, items: next.map(item => ({ ...item, id: genId() })), updatedAt: Date.now() });
    } catch (e: any) {
      setRecommendationStatus('error');
      setRecommendationMessage(e?.message ?? '즉시 적용하지 못했습니다.');
    }
  };

  const autoBalancePlan = () => {
    if (!activePlan || activePlan.items.length === 0 || planRemaining === 0) return;
    const items = [...activePlan.items];
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].unitPrice <= 0) continue;
      const others = items.filter((_, idx) => idx !== i).reduce((sum, item) => sum + item.subtotal, 0);
      const quantity = Math.max(1, Math.round((activePlan.totalBudget - others) / items[i].unitPrice));
      items[i] = { ...items[i], quantity, subtotal: items[i].unitPrice * quantity };
      break;
    }
    updatePlanItems(items);
  };

  const handleSave = async () => {
    if (!activePlan) return;
    const exists = plans.some(plan => plan.id === activePlan.id);
    await savePlans(exists ? plans.map(plan => plan.id === activePlan.id ? activePlan : plan) : [...plans, activePlan]);
  };

  const handleExportCsv = async () => {
    if (!activePlan) return;
    const rows = [
      ['순', '예산 과목', '품목', '품목코드', '규격', '단가(원)', '수량', '소계(원)'],
      ...activePlan.items.map((item, idx) => [
        String(idx + 1),
        item.budgetCategory,
        item.thngNm,
        item.thngCd ?? '',
        item.spec ?? '',
        String(item.unitPrice),
        String(item.quantity),
        String(item.subtotal),
      ]),
      ['', '', '', '', '합계', '', '', String(planTotalUsed)],
      ['', '', '', '', '배정 예산', '', '', String(activePlan.totalBudget)],
      ['', '', '', '', '잔액', '', '', String(planRemaining)],
    ];
    const csv = rows.map(row => row.map(col => `"${String(col).replace(/"/g, '""')}"`).join(',')).join('\n');
    await window.electronAPI.saveCsv(csv, `${activePlan.title}_예산사용계획`);
  };

  const API_GUIDE_STEPS = [
    { title: 'data.go.kr 접속 및 회원가입', desc: '공공데이터포털(data.go.kr)에 접속해 회원가입합니다.', action: { label: 'data.go.kr 열기', url: 'https://www.data.go.kr' } },
    { title: '조달청 API 검색', desc: '물품목록정보서비스와 종합쇼핑몰 품목정보 서비스를 활용신청합니다.' },
    { title: '활용신청', desc: '상세 페이지에서 활용신청을 누릅니다. 자동승인 후 바로 사용할 수 있습니다.' },
    { title: '인증키 복사', desc: '마이페이지의 개발계정 상세보기에서 일반 인증키를 복사합니다.' },
    { title: 'EduNote에 저장', desc: '아래 입력란에 인증키를 붙여넣고 저장합니다.' },
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
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">나라장터 API 키</span>
              <button onClick={() => { setShowApiGuide(!showApiGuide); setApiGuideStep(1); }} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                발급 방법 {showApiGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
            {showApiGuide && (
              <div className="mb-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-xs">
                <div className="flex gap-1 mb-2">
                  {API_GUIDE_STEPS.map((_, i) => (
                    <button key={i} onClick={() => setApiGuideStep(i + 1)}
                      className={`w-6 h-6 rounded-full text-[10px] font-bold ${apiGuideStep === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
                <p className="font-bold text-blue-800 dark:text-blue-200 mb-1">{API_GUIDE_STEPS[apiGuideStep - 1].title}</p>
                <p className="text-blue-700 dark:text-blue-300 leading-relaxed">{API_GUIDE_STEPS[apiGuideStep - 1].desc}</p>
                {(API_GUIDE_STEPS[apiGuideStep - 1] as any).action && (
                  <button onClick={() => window.electronAPI.openExternal((API_GUIDE_STEPS[apiGuideStep - 1] as any).action.url)}
                    className="mt-2 flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                    <ExternalLink className="w-3 h-3" /> {(API_GUIDE_STEPS[apiGuideStep - 1] as any).action.label}
                  </button>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="인증키 붙여넣기" className={inputCls} />
              <button onClick={saveApiKey} className={`${btnCls} bg-blue-600 text-white hover:bg-blue-700 shrink-0`}>저장</button>
            </div>
            {apiKey && <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> API 키 설정됨</p>}
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
              2. 과목별 비율과 검색어
            </button>
            {showRatio && CATEGORIES.map(category => (
              <div key={category} className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-20 text-xs font-bold text-gray-700 dark:text-gray-300">{category}</span>
                  <input
                    type="number"
                    min={0}
                    value={category === '교육운영비' ? ratioEdu : category === '일반수용비' ? ratioGeneral : ratioBiz}
                    onChange={e => category === '교육운영비' ? setRatioEdu(e.target.value) : category === '일반수용비' ? setRatioGeneral(e.target.value) : setRatioBiz(e.target.value)}
                    className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                  />
                  <span className="text-xs text-gray-500">% · {fmt(allocations[category])}원</span>
                </div>
                <input value={keywordMap[category]} onChange={e => setKeywordMap[category](e.target.value)} placeholder="검색어를 쉼표로 구분" className={inputCls} />
              </div>
            ))}
          </section>

          {plans.length > 0 && (
            <section className="p-4 border-b border-gray-100 dark:border-gray-700">
              <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">저장된 계획</p>
              <div className="space-y-1">
                {plans.map(plan => (
                  <button key={plan.id} onClick={() => { setActivePlan(plan); setTotalBudget(fmt(plan.totalBudget)); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs ${activePlan?.id === plan.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                    <p className="font-semibold truncate">{plan.title}</p>
                    <p className="text-gray-400">{fmt(plan.totalBudget)}원</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {activePlan && (
            <section className="p-4 space-y-3">
              <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">품목 추가</p>
              <div className="grid grid-cols-2 gap-2">
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value as BudgetCategory)} className={inputCls}>
                  {CATEGORIES.map(category => <option key={category}>{category}</option>)}
                </select>
                <select value={searchTarget} onChange={e => setSearchTarget(e.target.value as 'plan' | 'recommendation')} className={inputCls}>
                  <option value="plan">예산안에 추가</option>
                  <option value="recommendation">추천안에 추가</option>
                </select>
              </div>
              <div className="flex gap-1">
                <input value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch(searchKeyword)}
                  placeholder="나라장터 검색어" className={inputCls} />
                <button onClick={() => handleSearch(searchKeyword)} disabled={isSearching}
                  className={`${btnCls} bg-blue-600 text-white hover:bg-blue-700 shrink-0`}>
                  {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>
              {searchError && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{searchError}</p>}
              <div className="space-y-1 max-h-44 overflow-y-auto">
                {searchResults.map((item, idx) => (
                  <button key={`${item.thngCd}-${idx}`} onClick={() => addSearchResult(item)}
                    className="w-full text-left px-2 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{item.thngNm}</p>
                    <p className="text-[11px] text-gray-400 truncate">{item.spec}{item.mnfctCorpNm ? ` · ${item.mnfctCorpNm}` : ''}</p>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 font-bold">{item.unitPrice ? `${fmt(item.unitPrice)}원` : '단가 없음'}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select value={manualCategory} onChange={e => setManualCategory(e.target.value as BudgetCategory)} className={inputCls}>
                    {CATEGORIES.map(category => <option key={category}>{category}</option>)}
                  </select>
                  <select value={manualTarget} onChange={e => setManualTarget(e.target.value as 'plan' | 'recommendation')} className={inputCls}>
                    <option value="plan">예산안</option>
                    <option value="recommendation">추천안</option>
                  </select>
                </div>
                <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="직접 입력 품목명" className={inputCls} />
                <div className="grid grid-cols-2 gap-2">
                  <input value={manualPrice} onChange={e => setManualPrice(moneyInput(e.target.value))} placeholder="단가" className={inputCls} />
                  <input value={manualQty} onChange={e => setManualQty(e.target.value.replace(/[^0-9]/g, ''))} placeholder="수량" className={inputCls} />
                </div>
                <button onClick={addManualItem} disabled={!manualName.trim()} className={`${btnCls} w-full bg-emerald-600 text-white hover:bg-emerald-700`}>
                  <Plus className="w-4 h-4 inline mr-1" />직접 추가
                </button>
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
                      <Wand2 className="w-3.5 h-3.5" />추천안 만들기
                    </button>
                    <button onClick={applyRecommendations} disabled={recommendations.length === 0} className={`${btnCls} bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1`}>
                      추천안 적용
                    </button>
                    <button onClick={handleInstantApply} disabled={recommendationStatus === 'loading'} className={`${btnCls} bg-rose-600 text-white hover:bg-rose-700 flex items-center gap-1`}>
                      즉시 적용
                    </button>
                    <button onClick={autoBalancePlan} className={`${btnCls} bg-gray-700 text-white hover:bg-gray-800 flex items-center gap-1`}>
                      자동 0원
                    </button>
                    <button onClick={handleSave} className={`${btnCls} bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1`}>
                      <Save className="w-3.5 h-3.5" />저장
                    </button>
                    <button onClick={handleExportCsv} className={`${btnCls} bg-green-600 text-white hover:bg-green-700 flex items-center gap-1`}>
                      <Download className="w-3.5 h-3.5" />CSV
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
                    <h3 className="text-sm font-black text-gray-800 dark:text-gray-100">추천 결과</h3>
                    <button onClick={() => addItemToRecommendations(undefined, selectedCategory)} className={`${btnCls} bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 flex items-center gap-1`}>
                      <Plus className="w-3.5 h-3.5" />행 추가
                    </button>
                  </div>
                  <EditableBudgetTable
                    items={recommendations}
                    emptyText="추천안 만들기를 누르거나 왼쪽에서 추천안에 품목을 추가하세요"
                    totalBudget={budgetForCalc}
                    usedTotal={recommendationTotal}
                    remaining={recommendationRemaining}
                    allocations={allocations}
                    usedByCategory={recommendationUsedByCategory}
                    onChange={(id, patch) => setRecommendations(prev => updateRows(prev, id, patch))}
                    onRemove={(id) => setRecommendations(prev => prev.filter(item => item.id !== id))}
                  />
                </section>

                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-black text-gray-800 dark:text-gray-100">적용된 예산안</h3>
                    <button onClick={() => addItemToPlan(undefined, selectedCategory)} className={`${btnCls} bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 flex items-center gap-1`}>
                      <Plus className="w-3.5 h-3.5" />행 추가
                    </button>
                  </div>
                  <EditableBudgetTable
                    items={activePlan.items}
                    emptyText="추천안을 적용하거나 왼쪽에서 품목을 추가하세요"
                    totalBudget={activePlan.totalBudget}
                    usedTotal={planTotalUsed}
                    remaining={planRemaining}
                    allocations={allocations}
                    usedByCategory={usedByCategory}
                    onChange={(id, patch) => updatePlanItems(updateRows(activePlan.items, id, patch))}
                    onRemove={(id) => updatePlanItems(activePlan.items.filter(item => item.id !== id))}
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
  const raw = data?.response?.body?.items?.item ?? data?.body?.items?.item ?? [];
  const rows = Array.isArray(raw) ? raw : (raw ? [raw] : []);
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
  onRemove,
}: {
  items: BudgetItem[];
  emptyText: string;
  totalBudget: number;
  usedTotal: number;
  remaining: number;
  allocations: Record<BudgetCategory, number>;
  usedByCategory: Record<BudgetCategory, number>;
  onChange: (id: string, patch: Partial<Pick<BudgetItem, 'budgetCategory' | 'thngNm' | 'unitPrice' | 'quantity' | 'spec'>>) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="h-28 flex items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 text-sm">
        {emptyText}
      </div>
    );
  }

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
            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-20 text-center">수량</th>
            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-32 text-right">소계</th>
            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-center text-gray-500">{idx + 1}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                <select value={item.budgetCategory} onChange={e => onChange(item.id, { budgetCategory: e.target.value as BudgetCategory })}
                  className="w-full text-xs bg-transparent border-none focus:outline-none text-gray-700 dark:text-gray-300">
                  {CATEGORIES.map(category => <option key={category}>{category}</option>)}
                </select>
              </td>
              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                <input value={item.thngNm} onChange={e => onChange(item.id, { thngNm: e.target.value })}
                  placeholder="품목명" className="w-full text-xs bg-transparent border-none focus:outline-none text-gray-800 dark:text-gray-100 focus:ring-1 focus:ring-blue-400 rounded px-1" />
              </td>
              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                <input value={item.spec ?? ''} onChange={e => onChange(item.id, { spec: e.target.value })}
                  placeholder="규격" className="w-full text-xs bg-transparent border-none focus:outline-none text-gray-500 dark:text-gray-300 focus:ring-1 focus:ring-blue-400 rounded px-1" />
              </td>
              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                <input type="number" min={0} value={item.unitPrice}
                  onChange={e => onChange(item.id, { unitPrice: parseInt(e.target.value, 10) || 0 })}
                  className="w-full text-right text-xs bg-transparent border-none focus:outline-none text-gray-800 dark:text-gray-100 focus:ring-1 focus:ring-blue-400 rounded px-1" />
              </td>
              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                <input type="number" min={1} value={item.quantity}
                  onChange={e => onChange(item.id, { quantity: parseInt(e.target.value, 10) || 1 })}
                  className="w-full text-center text-xs bg-transparent border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-800 dark:text-gray-100" />
              </td>
              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-right font-semibold text-gray-800 dark:text-gray-100 text-xs">
                {fmt(item.subtotal)}
              </td>
              <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-center">
                <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600" title="행 삭제">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {CATEGORIES.map(category => (
            <tr key={category} className="bg-gray-50 dark:bg-gray-700/50 text-xs">
              <td colSpan={6} className="border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-right text-gray-600 dark:text-gray-300">
                {category} 배정 {fmt(allocations[category])}원 / 집행 {fmt(usedByCategory[category])}원
              </td>
              <td className={`border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-right font-bold ${allocations[category] - usedByCategory[category] < 0 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                {fmt(allocations[category] - usedByCategory[category])}
              </td>
              <td className="border border-gray-300 dark:border-gray-600"></td>
            </tr>
          ))}
          <tr className="bg-gray-50 dark:bg-gray-700/50 font-bold text-sm">
            <td colSpan={6} className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">합계</td>
            <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-right text-blue-700 dark:text-blue-300">{fmt(usedTotal)}</td>
            <td className="border border-gray-300 dark:border-gray-600"></td>
          </tr>
          <tr className="bg-gray-50 dark:bg-gray-700/50 text-sm">
            <td colSpan={6} className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-gray-600 dark:text-gray-400">배정 예산</td>
            <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-right text-gray-700 dark:text-gray-300">{fmt(totalBudget)}</td>
            <td className="border border-gray-300 dark:border-gray-600"></td>
          </tr>
          <tr className={`text-sm font-black ${remaining === 0 ? 'bg-green-50 dark:bg-green-900/20' : remaining < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
            <td colSpan={6} className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">잔액</td>
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
