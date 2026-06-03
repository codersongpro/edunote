import React, { useEffect, useState, useCallback } from 'react';
import { BudgetCategory, BudgetItem, BudgetPlan } from '../types';
import { Search, Plus, Trash2, Save, Download, RefreshCw, ChevronDown, ChevronUp, ExternalLink, AlertCircle, CheckCircle2, Wand2, PenLine } from 'lucide-react';

// ─── 예산 과목별 추천 키워드 ──────────────────────────────────────
const CATEGORY_KEYWORDS: Record<BudgetCategory, { label: string; keywords: string[] }[]> = {
  교육운영비: [
    { label: '교재·도서', keywords: ['도서', '교재', '학습지', '문제집', '참고서'] },
    { label: '미술·공예', keywords: ['색연필', '크레파스', '물감', '도화지', '스케치북', '찰흙'] },
    { label: '과학·실험', keywords: ['실험키트', '돋보기', '저울', '비커', '자석'] },
    { label: '체육·활동', keywords: ['줄넘기', '공', '훌라후프', '배드민턴', '탁구채'] },
    { label: '음악·악기', keywords: ['리코더', '멜로디언', '캐스터네츠', '탬버린'] },
    { label: 'ICT·디지털', keywords: ['USB', '마우스', '이어폰', '태블릿', '케이블'] },
  ],
  일반수용비: [
    { label: '사무용품', keywords: ['복사용지', '볼펜', '스테이플러', '클립', '메모지', '바인더'] },
    { label: '인쇄·소모품', keywords: ['토너', '잉크', '레이블지', 'OHP필름'] },
    { label: '청소·위생', keywords: ['청소용품', '세제', '걸레', '쓰레기봉투', '화장지', '손세정제'] },
    { label: '사무기기', keywords: ['계산기', '타공기', '코팅기', '라미네이트'] },
    { label: '포장·보관', keywords: ['파일', '서류함', '보관함', '지퍼백', '테이프'] },
  ],
  업무추진비: [
    { label: '음료·다과', keywords: ['커피', '음료', '주스', '차', '물'] },
    { label: '간식·제과', keywords: ['과자', '빵', '케이크', '쿠키', '사탕'] },
    { label: '선물·기념품', keywords: ['선물세트', '수건', '에코백', '노트', '머그컵'] },
    { label: '회의용품', keywords: ['화이트보드', '마커', '포스트잇', '네임택'] },
  ],
};

interface NaraItem {
  thngNm: string;
  thngCd: string;
  assetClCd?: string;
  assetClNm?: string;
  stdUntNm?: string;
  unitPrice?: number;
}

const fmt = (n: number) => n.toLocaleString('ko-KR');
const genId = () => crypto.randomUUID();

export default function BudgetPlannerScreen() {
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [activePlan, setActivePlan] = useState<BudgetPlan | null>(null);
  const [totalBudget, setTotalBudget] = useState('');
  const [planTitle, setPlanTitle] = useState('');

  // 검색
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory>('교육운영비');
  const [searchResults, setSearchResults] = useState<NaraItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiGuide, setShowApiGuide] = useState(false);
  const [apiGuideStep, setApiGuideStep] = useState(1);

  // 필터
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minQty, setMinQty] = useState('1');
  const [maxQty, setMaxQty] = useState('');

  // 직접 입력
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualCategory, setManualCategory] = useState<BudgetCategory>('교육운영비');
  const [searchTab, setSearchTab] = useState<'search' | 'manual'>('search');

  // 로드
  useEffect(() => {
    window.electronAPI.getConfig('naramarketApiKey').then((k: string) => { if (k) setApiKey(k); }).catch(() => {});
    window.electronAPI.readJsonData('budget-plans').then((data: unknown) => {
      if (Array.isArray(data)) setPlans(data as BudgetPlan[]);
    }).catch(() => {});
  }, []);

  const savePlans = async (updated: BudgetPlan[]) => {
    setPlans(updated);
    await window.electronAPI.writeJsonData('budget-plans', updated);
  };

  const saveApiKey = async (key: string) => {
    setApiKey(key);
    await window.electronAPI.setConfig({ naramarketApiKey: key });
  };

  // 새 계획 만들기
  const handleNewPlan = () => {
    const budget = parseInt(totalBudget.replace(/,/g, ''), 10);
    if (!planTitle.trim() || isNaN(budget) || budget <= 0) return;
    const plan: BudgetPlan = {
      id: genId(),
      title: planTitle.trim(),
      totalBudget: budget,
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setActivePlan(plan);
  };

  // 나라장터 검색
  const handleSearch = async (keyword: string) => {
    if (!keyword.trim()) return;
    if (!apiKey.trim()) { setSearchError('나라장터 API 키를 설정해주세요.'); return; }
    setIsSearching(true);
    setSearchError('');
    try {
      const data = await window.electronAPI.naramarketSearch(keyword.trim(), apiKey);
      const items: NaraItem[] = data?.response?.body?.items?.item ?? [];
      if (!Array.isArray(items) || items.length === 0) {
        setSearchResults([]);
        setSearchError('검색 결과가 없습니다.');
      } else {
        let filtered = items;
        if (minPrice) filtered = filtered.filter(i => (i.unitPrice ?? 0) >= parseInt(minPrice.replace(/,/g, ''), 10));
        if (maxPrice) filtered = filtered.filter(i => (i.unitPrice ?? 0) <= parseInt(maxPrice.replace(/,/g, ''), 10));
        setSearchResults(filtered);
      }
    } catch (e: any) {
      setSearchError(e.message ?? '검색 오류');
    } finally {
      setIsSearching(false);
    }
  };

  // 물품 추가
  const addItem = (naraItem: NaraItem) => {
    if (!activePlan) return;
    const qty = parseInt(minQty || '1', 10);
    const unitPrice = naraItem.unitPrice ?? 0;
    const item: BudgetItem = {
      id: genId(),
      budgetCategory: selectedCategory,
      thngNm: naraItem.thngNm,
      thngCd: naraItem.thngCd,
      spec: naraItem.stdUntNm,
      unitPrice,
      quantity: qty,
      subtotal: unitPrice * qty,
    };
    const updated = { ...activePlan, items: [...activePlan.items, item], updatedAt: Date.now() };
    setActivePlan(updated);
  };

  // 아이템 수정
  const updateItem = (id: string, field: 'unitPrice' | 'quantity', value: number) => {
    if (!activePlan) return;
    const items = activePlan.items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      updated.subtotal = updated.unitPrice * updated.quantity;
      return updated;
    });
    setActivePlan({ ...activePlan, items, updatedAt: Date.now() });
  };

  const removeItem = (id: string) => {
    if (!activePlan) return;
    setActivePlan({ ...activePlan, items: activePlan.items.filter(i => i.id !== id), updatedAt: Date.now() });
  };

  const addManualItem = () => {
    if (!activePlan || !manualName.trim()) return;
    const price = parseInt(manualPrice.replace(/,/g, ''), 10) || 0;
    const qty = parseInt(manualQty, 10) || 1;
    const item: BudgetItem = {
      id: genId(),
      budgetCategory: manualCategory,
      thngNm: manualName.trim(),
      unitPrice: price,
      quantity: qty,
      subtotal: price * qty,
    };
    setActivePlan({ ...activePlan, items: [...activePlan.items, item], updatedAt: Date.now() });
    setManualName('');
    setManualPrice('');
    setManualQty('1');
  };

  // 합계 계산
  const totalUsed = activePlan?.items.reduce((s, i) => s + i.subtotal, 0) ?? 0;
  const remaining = (activePlan?.totalBudget ?? 0) - totalUsed;

  // 자동 0원 맞추기: 마지막 아이템의 수량을 조정
  const autoBalance = () => {
    if (!activePlan || activePlan.items.length === 0 || remaining === 0) return;
    const items = [...activePlan.items];
    // 단가가 있는 마지막 아이템의 수량으로 조정
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].unitPrice > 0) {
        const others = items.filter((_, idx) => idx !== i).reduce((s, x) => s + x.subtotal, 0);
        const needed = activePlan.totalBudget - others;
        const qty = Math.max(1, Math.round(needed / items[i].unitPrice));
        const maxQ = maxQty ? parseInt(maxQty, 10) : Infinity;
        const minQ = minQty ? parseInt(minQty, 10) : 1;
        items[i] = { ...items[i], quantity: Math.min(Math.max(qty, minQ), maxQ), subtotal: 0 };
        items[i].subtotal = items[i].unitPrice * items[i].quantity;
        break;
      }
    }
    setActivePlan({ ...activePlan, items, updatedAt: Date.now() });
  };

  // 저장
  const handleSave = async () => {
    if (!activePlan) return;
    const exists = plans.find(p => p.id === activePlan.id);
    const updated = exists
      ? plans.map(p => p.id === activePlan.id ? activePlan : p)
      : [...plans, activePlan];
    await savePlans(updated);
  };

  // CSV 내보내기
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
      ['', '', '', '', '합계', '', '', String(totalUsed)],
      ['', '', '', '', '배정 예산', '', '', String(activePlan.totalBudget)],
      ['', '', '', '', '잔액', '', '', String(remaining)],
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    await window.electronAPI.saveCsv('﻿' + csv, `${activePlan.title}_예산사용계획`);
  };

  const inputCls = 'w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const btnCls = 'px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors';

  // ── API 발급 안내 ──────────────────────────────────────────────
  const API_GUIDE_STEPS = [
    { title: 'data.go.kr 접속 및 회원가입', desc: '공공데이터포털(data.go.kr)에 접속해 회원가입합니다. 일반 이메일로 가입 가능하며 공공기관 이메일은 필요 없습니다.', action: { label: 'data.go.kr 열기', url: 'https://www.data.go.kr' } },
    { title: '"조달청 물품목록" 검색', desc: '로그인 후 검색창에 "조달청 물품목록정보서비스"를 검색하고 해당 API를 클릭합니다.' },
    { title: '[활용신청] 클릭', desc: '상세 페이지에서 [활용신청] 버튼을 클릭합니다. 자동승인으로 즉시 발급되며 별도 심사가 없습니다.' },
    { title: '인증키 복사', desc: '마이페이지 → 개발계정 → 개발계정 상세보기 에서 "일반 인증키"를 복사합니다.' },
    { title: 'EduNote에 붙여넣기', desc: '아래 입력란에 복사한 인증키를 붙여넣고 저장 버튼을 누르세요.' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA] dark:bg-gray-900">
      <div className="shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3 flex items-center gap-3">
        <h1 className="text-base font-black text-gray-900 dark:text-white">예산사용계획</h1>
        <span className="text-xs text-gray-400">나라장터 물품으로 예산 0원 만들기</span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽: 설정 + 검색 */}
        <div className="w-72 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col overflow-y-auto">

          {/* API 키 설정 */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
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
                      className={`w-6 h-6 rounded-full text-[10px] font-bold transition-colors ${apiGuideStep === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
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
                <div className="flex justify-between mt-2">
                  <button onClick={() => setApiGuideStep(s => Math.max(1, s - 1))} disabled={apiGuideStep === 1} className="text-gray-400 disabled:opacity-30">◀ 이전</button>
                  <button onClick={() => setApiGuideStep(s => Math.min(5, s + 1))} disabled={apiGuideStep === 5} className="text-blue-500 disabled:opacity-30">다음 ▶</button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="인증키 붙여넣기" className={inputCls} />
              <button onClick={() => saveApiKey(apiKey)} className={`${btnCls} bg-blue-600 text-white hover:bg-blue-700 shrink-0`}>저장</button>
            </div>
            {apiKey && <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> API 키 설정됨</p>}
          </div>

          {/* 새 계획 */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">새 예산계획</p>
            <input value={planTitle} onChange={e => setPlanTitle(e.target.value)} placeholder="계획 제목 (예: 2026-2학기 교육운영비)" className={`${inputCls} mb-2`} />
            <input value={totalBudget} onChange={e => setTotalBudget(e.target.value.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))} placeholder="배정 예산 (원)" className={`${inputCls} mb-2`} />
            <button onClick={handleNewPlan} disabled={!planTitle.trim() || !totalBudget} className={`${btnCls} w-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40`}>
              <Plus className="w-4 h-4 inline mr-1" />계획 시작
            </button>
          </div>

          {/* 저장된 계획 목록 */}
          {plans.length > 0 && (
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">저장된 계획</p>
              <div className="space-y-1">
                {plans.map(p => (
                  <button key={p.id} onClick={() => setActivePlan(p)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${activePlan?.id === p.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                    <p className="font-semibold truncate">{p.title}</p>
                    <p className="text-gray-400">{fmt(p.totalBudget)}원</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 물품 추가 패널 */}
          {activePlan && (
            <div className="p-4 flex-1 flex flex-col overflow-hidden">
              {/* 탭 */}
              <div className="flex gap-1 mb-3 shrink-0">
                <button
                  onClick={() => setSearchTab('search')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 ${searchTab === 'search' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                >
                  <Search className="w-3 h-3" />나라장터 검색
                </button>
                <button
                  onClick={() => setSearchTab('manual')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 ${searchTab === 'manual' ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                >
                  <PenLine className="w-3 h-3" />직접 입력
                </button>
              </div>

              {/* 나라장터 검색 탭 */}
              {searchTab === 'search' && (
                <div className="flex-1 overflow-y-auto space-y-2">
                  <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value as BudgetCategory)} className={inputCls}>
                    <option value="교육운영비">교육운영비</option>
                    <option value="일반수용비">일반수용비</option>
                    <option value="업무추진비">업무추진비</option>
                  </select>
                  {/* 추천 키워드 */}
                  <div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">추천 키워드</p>
                    <div className="space-y-1">
                      {CATEGORY_KEYWORDS[selectedCategory].map(group => (
                        <div key={group.label}>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">{group.label}</p>
                          <div className="flex flex-wrap gap-1">
                            {group.keywords.map(kw => (
                              <button key={kw} onClick={() => { setSearchKeyword(kw); handleSearch(kw); }}
                                className="px-2 py-0.5 text-[11px] bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-gray-700 dark:text-gray-300 rounded-full transition-colors">
                                {kw}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* 검색어 직접 입력 */}
                  <div className="flex gap-1">
                    <input value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch(searchKeyword)}
                      placeholder="검색어 입력 후 Enter" className={inputCls} />
                    <button onClick={() => handleSearch(searchKeyword)} disabled={isSearching}
                      className={`${btnCls} bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 shrink-0`}>
                      {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* 단가/수량 필터 */}
                  <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-2 text-xs">
                    <p className="font-bold text-gray-600 dark:text-gray-400 mb-1">단가·수량 필터</p>
                    <div className="grid grid-cols-2 gap-1">
                      <input value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="최소 단가" className={inputCls} />
                      <input value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="최대 단가" className={inputCls} />
                      <input value={minQty} onChange={e => setMinQty(e.target.value)} placeholder="최소 수량" className={inputCls} />
                      <input value={maxQty} onChange={e => setMaxQty(e.target.value)} placeholder="최대 수량" className={inputCls} />
                    </div>
                  </div>
                  {searchError && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{searchError}</p>}
                  {/* 검색 결과 */}
                  <div className="space-y-1">
                    {searchResults.map((item, idx) => (
                      <button key={idx} onClick={() => addItem(item)}
                        className="w-full text-left px-2 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{item.thngNm}</p>
                        <p className="text-[11px] text-gray-400">{item.thngCd} {item.stdUntNm ? `· ${item.stdUntNm}` : ''}</p>
                        {item.unitPrice != null && <p className="text-[11px] text-blue-600 dark:text-blue-400 font-bold">{fmt(item.unitPrice)}원</p>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 직접 입력 탭 */}
              {searchTab === 'manual' && (
                <div className="flex-1 space-y-2">
                  <select value={manualCategory} onChange={e => setManualCategory(e.target.value as BudgetCategory)} className={inputCls}>
                    <option value="교육운영비">교육운영비</option>
                    <option value="일반수용비">일반수용비</option>
                    <option value="업무추진비">업무추진비</option>
                  </select>
                  <input
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    placeholder="품목명 *"
                    className={inputCls}
                  />
                  <input
                    value={manualPrice}
                    onChange={e => setManualPrice(e.target.value)}
                    placeholder="단가 (원)"
                    className={inputCls}
                  />
                  <input
                    value={manualQty}
                    onChange={e => setManualQty(e.target.value)}
                    placeholder="수량"
                    type="number"
                    min={1}
                    className={inputCls}
                  />
                  <button
                    onClick={addManualItem}
                    disabled={!manualName.trim()}
                    className={`w-full ${btnCls} bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-1`}
                  >
                    <Plus className="w-4 h-4" />
                    품목 추가
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 오른쪽: 계획표 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!activePlan ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-4xl mb-3">💰</p>
                <p className="font-bold">왼쪽에서 새 예산계획을 시작하거나</p>
                <p className="text-sm">저장된 계획을 선택하세요</p>
              </div>
            </div>
          ) : (
            <>
              {/* 헤더 */}
              <div className="shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-black text-gray-900 dark:text-white">{activePlan.title}</h2>
                    <p className="text-xs text-gray-500">배정 예산: {fmt(activePlan.totalBudget)}원</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={autoBalance} className={`${btnCls} bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1`}>
                      <Wand2 className="w-3.5 h-3.5" />자동 0원
                    </button>
                    <button onClick={handleSave} className={`${btnCls} bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1`}>
                      <Save className="w-3.5 h-3.5" />저장
                    </button>
                    <button onClick={handleExportCsv} className={`${btnCls} bg-green-600 text-white hover:bg-green-700 flex items-center gap-1`}>
                      <Download className="w-3.5 h-3.5" />CSV
                    </button>
                  </div>
                </div>

                {/* 예산 현황 바 */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">집행: {fmt(totalUsed)}원</span>
                    <span className={`font-bold ${remaining === 0 ? 'text-green-600' : remaining < 0 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                      {remaining === 0 ? '✓ 잔액 0원 달성!' : remaining > 0 ? `잔액 ${fmt(remaining)}원` : `초과 ${fmt(Math.abs(remaining))}원`}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${remaining < 0 ? 'bg-red-500' : remaining === 0 ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(100, (totalUsed / activePlan.totalBudget) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 테이블 */}
              <div className="flex-1 overflow-auto px-4 py-3">
                {activePlan.items.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    왼쪽 검색 결과에서 물품을 클릭하여 추가하세요
                  </div>
                ) : (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
                        <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center w-8">순</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-24">예산 과목</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-2 py-2">품목</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-28 text-right">단가(원)</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-20 text-center">수량</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-32 text-right">소계(원)</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePlan.items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-center text-gray-500">{idx + 1}</td>
                          <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                            <select value={item.budgetCategory}
                              onChange={e => {
                                const items = activePlan.items.map(i => i.id === item.id ? { ...i, budgetCategory: e.target.value as BudgetCategory } : i);
                                setActivePlan({ ...activePlan, items });
                              }}
                              className="w-full text-xs bg-transparent border-none focus:outline-none text-gray-700 dark:text-gray-300">
                              <option>교육운영비</option>
                              <option>일반수용비</option>
                              <option>업무추진비</option>
                            </select>
                          </td>
                          <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                            <div>
                              <p className="font-semibold text-gray-800 dark:text-gray-100 text-xs">{item.thngNm}</p>
                              {item.spec && <p className="text-[11px] text-gray-400">{item.spec}</p>}
                            </div>
                          </td>
                          <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                            <input type="number" value={item.unitPrice}
                              onChange={e => updateItem(item.id, 'unitPrice', parseInt(e.target.value, 10) || 0)}
                              className="w-full text-right text-xs bg-transparent border-none focus:outline-none text-gray-800 dark:text-gray-100 focus:ring-1 focus:ring-blue-400 rounded px-1" />
                          </td>
                          <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                            <div className="flex items-center gap-1 justify-center">
                              <button onClick={() => updateItem(item.id, 'quantity', Math.max(1, item.quantity - 1))} className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 text-xs font-bold">−</button>
                              <input type="number" value={item.quantity}
                                onChange={e => {
                                  let v = parseInt(e.target.value, 10) || 1;
                                  if (minQty) v = Math.max(parseInt(minQty, 10), v);
                                  if (maxQty) v = Math.min(parseInt(maxQty, 10), v);
                                  updateItem(item.id, 'quantity', v);
                                }}
                                className="w-10 text-center text-xs bg-transparent border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-800 dark:text-gray-100" />
                              <button onClick={() => updateItem(item.id, 'quantity', item.quantity + 1)} className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 text-xs font-bold">+</button>
                            </div>
                          </td>
                          <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-right font-semibold text-gray-800 dark:text-gray-100 text-xs">
                            {fmt(item.subtotal)}
                          </td>
                          <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-center">
                            <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 dark:bg-gray-700/50 font-bold text-sm">
                        <td colSpan={5} className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">합계</td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-right text-blue-700 dark:text-blue-300">{fmt(totalUsed)}</td>
                        <td className="border border-gray-300 dark:border-gray-600"></td>
                      </tr>
                      <tr className="bg-gray-50 dark:bg-gray-700/50 text-sm">
                        <td colSpan={5} className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-gray-600 dark:text-gray-400">배정 예산</td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-right text-gray-700 dark:text-gray-300">{fmt(activePlan.totalBudget)}</td>
                        <td className="border border-gray-300 dark:border-gray-600"></td>
                      </tr>
                      <tr className={`text-sm font-black ${remaining === 0 ? 'bg-green-50 dark:bg-green-900/20' : remaining < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                        <td colSpan={5} className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">잔액</td>
                        <td className={`border border-gray-300 dark:border-gray-600 px-2 py-2 text-right ${remaining === 0 ? 'text-green-700 dark:text-green-400' : remaining < 0 ? 'text-red-600' : 'text-amber-700 dark:text-amber-400'}`}>
                          {remaining === 0 ? '0 ✓' : fmt(remaining)}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600"></td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
