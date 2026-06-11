import React, { useState, useEffect, useRef } from 'react';
import { BookMarked, Plus, Trash2, ExternalLink, Search, X, Loader2, Youtube, Globe, Tag, Edit2, Check, FolderPlus, Camera, SearchIcon, ArrowLeft, ArrowRight, RefreshCw, PlusCircle } from 'lucide-react';
import { safeSetItem } from '../lib/safeStorage';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string; allowpopups?: string; useragent?: string;
      }, HTMLElement>;
    }
  }
}

interface Resource {
  id: string;
  url: string;
  title: string;
  description: string;
  thumbnail: string;
  type: 'youtube' | 'web';
  tags: string;
  category: string;
  createdAt: number;
}

const STORAGE_KEY = 'eduNote_resources_v2';
const CATEGORIES_KEY = 'eduNote_resource_categories_v1';

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

function isYoutubeUrl(url: string): boolean { return !!extractYoutubeId(url); }

function loadResources(): Resource[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveResources(list: Resource[]) { safeSetItem(STORAGE_KEY, JSON.stringify(list)); }

function loadCategories(): string[] {
  try { return JSON.parse(localStorage.getItem(CATEGORIES_KEY) || '[]'); }
  catch { return []; }
}
function saveCategories(cats: string[]) { safeSetItem(CATEGORIES_KEY, JSON.stringify(cats)); }

const MyResourceLibrary: React.FC = () => {
  const [resources, setResources] = useState<Resource[]>(loadResources);
  const [categories, setCategories] = useState<string[]>(loadCategories);
  const [loadedFromFolder, setLoadedFromFolder] = useState(false);
  const [dataPath, setDataPath] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('전체');
  const [search, setSearch] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addTags, setAddTags] = useState('');
  const [addCategory, setAddCategory] = useState('');
  const [addThumbnail, setAddThumbnail] = useState('');
  const [newCatInput, setNewCatInput] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchStep, setFetchStep] = useState('');
  const [fetchError, setFetchError] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // 자료의 분류(카테고리)를 변경 중인 자료 ID — 드롭다운 메뉴 표시 제어용
  const [categoryEditId, setCategoryEditId] = useState<string | null>(null);

  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatManagerInput, setNewCatManagerInput] = useState('');

  const urlInputRef = useRef<HTMLInputElement>(null);
  const webviewRef = useRef<any>(null);
  const [showWebSearch, setShowWebSearch] = useState(false);
  const [webSearchEngine, setWebSearchEngine] = useState<'google' | 'youtube'>('google');
  const [webSearchQuery, setWebSearchQuery] = useState('');
  const [webviewSrc, setWebviewSrc] = useState('');
  const [webviewCurrentUrl, setWebviewCurrentUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [savedResources, savedCategories, filePath] = await Promise.all([
          window.electronAPI.readJsonData('resource-library'),
          window.electronAPI.readJsonData('resource-categories'),
          window.electronAPI.getJsonDataPath('resource-library'),
        ]);
        if (cancelled) return;
        setDataPath(filePath);
        if (Array.isArray(savedResources)) setResources(savedResources as Resource[]);
        if (Array.isArray(savedCategories)) setCategories(savedCategories as string[]);
        if (!savedResources) {
          window.electronAPI.writeJsonData('resource-library', loadResources()).catch(() => {});
          window.electronAPI.writeJsonData('resource-categories', loadCategories()).catch(() => {});
        }
      } finally {
        if (!cancelled) setLoadedFromFolder(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loadedFromFolder) return;
    saveResources(resources);
    window.electronAPI.writeJsonData('resource-library', resources).catch(() => {});
  }, [resources, loadedFromFolder]);
  useEffect(() => {
    if (!loadedFromFolder) return;
    saveCategories(categories);
    window.electronAPI.writeJsonData('resource-categories', categories).catch(() => {});
  }, [categories, loadedFromFolder]);
  useEffect(() => { if (showAdd) setTimeout(() => urlInputRef.current?.focus(), 50); }, [showAdd]);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    const onNav = () => setWebviewCurrentUrl(wv.getURL?.() ?? '');
    wv.addEventListener('did-navigate', onNav);
    wv.addEventListener('did-navigate-in-page', onNav);
    return () => {
      wv.removeEventListener('did-navigate', onNav);
      wv.removeEventListener('did-navigate-in-page', onNav);
    };
  }, [webviewSrc]);

  const handleWebSearch = () => {
    if (!webSearchQuery.trim()) return;
    const q = encodeURIComponent(webSearchQuery.trim());
    if (webSearchEngine === 'google') {
      setWebviewSrc(`https://www.google.com/search?q=${q}`);
    } else {
      setWebviewSrc(`https://www.youtube.com/results?search_query=${q}`);
    }
    setWebviewCurrentUrl('');
  };

  const handleAddCurrentWebPage = () => {
    const url = webviewRef.current?.getURL?.() || webviewCurrentUrl || webviewSrc;
    if (!url || url === 'about:blank') return;
    setAddUrl(url);
    setShowWebSearch(false);
    setShowAdd(true);
    setTimeout(() => urlInputRef.current?.focus(), 100);
  };

  const addCategory_save = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    setCategories(prev => [...prev, trimmed]);
  };

  const removeCategory = (name: string) => {
    setCategories(prev => prev.filter(c => c !== name));
    setResources(prev => prev.map(r => r.category === name ? { ...r, category: '' } : r));
    if (activeCategory === name) setActiveCategory('전체');
  };

  const autoClassify = async (title: string, desc: string, url: string): Promise<string> => {
    if (categories.length === 0) return '';
    try {
      const prompt = `다음 웹 자료의 주제를 아래 카테고리 중 하나로 분류해주세요.

카테고리 목록: ${categories.join(', ')}

웹 자료 정보:
- URL: ${url}
- 제목: ${title}
- 설명: ${desc}

규칙:
- 반드시 위 카테고리 목록 중 하나만 정확히 그대로 답하세요.
- 맞는 카테고리가 없으면 "없음"이라고만 답하세요.
- 다른 설명 없이 카테고리 이름 하나만 출력하세요.`;
      const result = await window.electronAPI.aiGenerate(prompt, undefined, { temperature: 0 });
      const matched = categories.find(c => result.trim() === c || result.trim().startsWith(c));
      return matched ?? '';
    } catch {
      return '';
    }
  };

  const handleFetchMeta = async () => {
    if (!addUrl.trim()) return;
    setFetching(true); setFetchError(''); setAddThumbnail('');
    try {
      let url = addUrl.trim();
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      setAddUrl(url);

      const ytId = extractYoutubeId(url);

      // 1. Fetch page metadata
      setFetchStep('페이지 정보 가져오는 중...');
      if (!ytId) {
        const meta = await window.electronAPI.fetchUrlMeta(url);
        if (meta.title && !addTitle) setAddTitle(meta.title);
        if (meta.description && !addDesc) setAddDesc(meta.description);

        // 2a. Thumbnail: try og:image first, then screenshot
        if (meta.image) {
          setFetchStep('썸네일 이미지 가져오는 중...');
          const imgData = await (window.electronAPI as any).fetchImage(meta.image);
          if (imgData) {
            setAddThumbnail(imgData);
          } else {
            setFetchStep('스크린샷 촬영 중... (최대 15초)');
            const shot = await (window.electronAPI as any).screenshotUrl(url);
            if (shot) setAddThumbnail(shot);
          }
        } else {
          setFetchStep('스크린샷 촬영 중... (최대 15초)');
          const shot = await (window.electronAPI as any).screenshotUrl(url);
          if (shot) setAddThumbnail(shot);
        }

        // 3. Auto-classify
        if (categories.length > 0 && !addCategory) {
          setFetchStep('자동 분류 중...');
          const cat = await autoClassify(meta.title || addTitle, meta.description || addDesc, url);
          if (cat) setAddCategory(cat);
        }
      } else {
        // YouTube — 제목과 썸네일 자동 가져오기
        let resolvedTitle = addTitle;
        if (!resolvedTitle) {
          setFetchStep('YouTube 영상 정보 가져오는 중...');
          const meta = await window.electronAPI.fetchYoutubeMeta(url);
          resolvedTitle = meta.title || 'YouTube 영상';
          setAddTitle(resolvedTitle);
          if (!addDesc && meta.description) setAddDesc(meta.description);
        }
        setFetchStep('YouTube 썸네일 가져오는 중...');
        const ytMeta = await window.electronAPI.fetchYoutubeMeta(url);
        const ytThumbUrl = ytMeta.thumbnail || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        const imgData = await (window.electronAPI as any).fetchImage(ytThumbUrl);
        if (imgData) setAddThumbnail(imgData);

        // 자동 분류 — resolvedTitle 사용 (클로저의 addTitle은 아직 업데이트 안 됨)
        if (categories.length > 0 && !addCategory && resolvedTitle) {
          setFetchStep('자동 분류 중...');
          const cat = await autoClassify(resolvedTitle, addDesc, url);
          if (cat) setAddCategory(cat);
        }
      }
    } catch {
      setFetchError('정보를 불러오지 못했습니다. 직접 입력해주세요.');
    } finally {
      setFetching(false);
      setFetchStep('');
    }
  };

  useEffect(() => {
    if (!showAdd || fetching || addTitle || addThumbnail || !isYoutubeUrl(addUrl)) return;
    const id = window.setTimeout(() => {
      handleFetchMeta();
    }, 700);
    return () => window.clearTimeout(id);
  }, [addUrl, showAdd, fetching, addTitle, addThumbnail]);

  const resetForm = () => {
    setAddUrl(''); setAddTitle(''); setAddDesc(''); setAddTags('');
    setAddCategory(''); setAddThumbnail(''); setFetchError(''); setShowNewCat(false);
  };

  const handleAdd = () => {
    if (!addUrl.trim()) return;
    let url = addUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const ytId = extractYoutubeId(url);
    const item: Resource = {
      id: Date.now().toString(),
      url,
      title: addTitle || url,
      description: addDesc,
      thumbnail: addThumbnail,
      type: ytId ? 'youtube' : 'web',
      tags: addTags,
      category: addCategory,
      createdAt: Date.now(),
    };
    setResources(prev => [item, ...prev]);
    resetForm();
    setShowAdd(false);
  };

  const handleDelete = (id: string) => setResources(prev => prev.filter(r => r.id !== id));

  const handleEditSave = (id: string) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, title: editTitle, description: editDesc } : r));
    setEditId(null);
  };

  // 자료의 분류(카테고리)를 즉시 변경하는 핸들러 — 드롭다운에서 카테고리 선택 시 호출
  const handleCategoryChange = (id: string, newCategory: string) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, category: newCategory } : r));
    setCategoryEditId(null);
  };

  // 드롭다운 메뉴 외부 클릭 시 자동 닫기
  useEffect(() => {
    if (!categoryEditId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-category-dropdown]')) {
        setCategoryEditId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [categoryEditId]);

  const filtered = resources.filter(r => {
    const catMatch = activeCategory === '전체' || r.category === activeCategory ||
      (activeCategory === '미분류' && !r.category);
    if (!catMatch) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) ||
      r.tags.toLowerCase().includes(q) || r.url.toLowerCase().includes(q);
  });

  const inputClass = 'w-full bg-white rounded-lg border border-[#E7E5E4] text-[#1C1917] text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none p-2.5 transition-all';
  const allTabs = ['전체', ...categories, ...(resources.some(r => !r.category) ? ['미분류'] : [])];

  return (
    <div className="flex flex-col h-full bg-[#FAF9F7] dark:bg-[#171210] overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full p-4 space-y-3">

        {/* Header */}
        <div className="bg-white dark:bg-[#221E1B] rounded-xl border border-[#EDE8E1] dark:border-[#2E2822] shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-teal-100 p-2 rounded-lg">
                <BookMarked className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h2 className="font-bold text-[#1C1917] dark:text-[#F0EBE6]">나만의 자료실</h2>
                <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">
                  유용한 웹사이트·영상을 주제별로 모아두세요. {dataPath && '지정 폴더에 자동 저장됩니다.'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 flex-wrap">
              <button
                onClick={() => setShowCatManager(s => !s)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[#E7E5E4] text-[#78716C] rounded-lg hover:bg-[#FAF9F7] transition-colors whitespace-nowrap shrink-0"
              >
                <FolderPlus className="w-4 h-4" />
                주제 관리
              </button>
              <button
                onClick={() => { setShowWebSearch(s => !s); setShowAdd(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors font-semibold whitespace-nowrap shrink-0 ${showWebSearch ? 'bg-blue-500 text-white border-blue-500' : 'border-[#E7E5E4] text-[#78716C] hover:bg-[#FAF9F7]'}`}
              >
                <SearchIcon className="w-4 h-4" />
                웹 검색
              </button>
              <button
                onClick={() => { setShowAdd(!showAdd); setShowWebSearch(false); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-teal-500 text-white text-sm font-semibold rounded-lg hover:bg-teal-600 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                추가
              </button>
            </div>
          </div>
        </div>

        {/* Category manager */}
        {showCatManager && (
          <div className="bg-white rounded-xl border border-teal-200 shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-bold text-[#44403C]">주제(폴더) 관리</h3>
            <div className="flex gap-2">
              <input
                type="text"
                className={inputClass}
                placeholder="새 주제 이름 입력..."
                value={newCatManagerInput}
                onChange={e => setNewCatManagerInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { addCategory_save(newCatManagerInput); setNewCatManagerInput(''); } }}
              />
              <button
                onClick={() => { addCategory_save(newCatManagerInput); setNewCatManagerInput(''); }}
                disabled={!newCatManagerInput.trim()}
                className="px-4 py-2 text-sm bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors font-semibold disabled:opacity-50 shrink-0"
              >추가</button>
            </div>
            {categories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <div key={cat} className="flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-teal-700 rounded-full px-3 py-1 text-sm">
                    <span>{cat}</span>
                    <button onClick={() => removeCategory(cat)} className="text-teal-400 hover:text-red-500 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#A8A29E]">아직 주제가 없습니다.</p>
            )}
          </div>
        )}

        {/* Web search panel */}
        {showWebSearch && (
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
            {/* Search controls */}
            <div className="p-3 border-b border-[#EDE8E1] space-y-2">
              <div className="flex gap-2">
                <div className="flex rounded-lg border border-[#EDE8E1] overflow-hidden shrink-0">
                  <button
                    onClick={() => setWebSearchEngine('google')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${webSearchEngine === 'google' ? 'bg-blue-500 text-white' : 'bg-white text-[#78716C] hover:bg-[#FAF9F7]'}`}
                  >
                    <Globe className="w-3.5 h-3.5" />구글
                  </button>
                  <button
                    onClick={() => setWebSearchEngine('youtube')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${webSearchEngine === 'youtube' ? 'bg-red-500 text-white' : 'bg-white text-[#78716C] hover:bg-[#FAF9F7]'}`}
                  >
                    <Youtube className="w-3.5 h-3.5" />유튜브
                  </button>
                </div>
                <input
                  type="text"
                  className="flex-1 bg-white rounded-lg border border-[#EDE8E1] text-[#1C1917] text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none px-3 py-1.5"
                  placeholder="검색어를 입력하세요..."
                  value={webSearchQuery}
                  onChange={e => setWebSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleWebSearch()}
                />
                <button
                  onClick={handleWebSearch}
                  disabled={!webSearchQuery.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold disabled:opacity-50 shrink-0"
                >
                  <SearchIcon className="w-4 h-4" />검색
                </button>
              </div>
              {webviewSrc && (
                <div className="flex items-center gap-2">
                  <button onClick={() => webviewRef.current?.goBack?.()} className="p-1 text-[#A8A29E] hover:text-[#44403C] rounded" title="뒤로">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => webviewRef.current?.goForward?.()} className="p-1 text-[#A8A29E] hover:text-[#44403C] rounded" title="앞으로">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button onClick={() => webviewRef.current?.reload?.()} className="p-1 text-[#A8A29E] hover:text-[#44403C] rounded" title="새로고침">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <span className="flex-1 text-xs text-[#A8A29E] truncate px-1">{webviewCurrentUrl || webviewSrc}</span>
                  <button
                    onClick={handleAddCurrentWebPage}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors font-semibold shrink-0"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />현재 페이지 추가
                  </button>
                </div>
              )}
            </div>
            {/* Webview */}
            {webviewSrc ? (
              <div style={{ height: 500 }}>
                <webview
                  ref={webviewRef}
                  src={webviewSrc}
                  style={{ width: '100%', height: '100%', display: 'flex' }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <Globe className="w-12 h-12 text-[#EDE8E1]" />
                <p className="text-sm text-[#A8A29E]">검색어를 입력하고 검색 버튼을 눌러주세요.</p>
                <p className="text-xs text-[#E7E5E4]">원하는 페이지를 찾으면 <strong>현재 페이지 추가</strong> 버튼으로 자료실에 저장하세요.</p>
              </div>
            )}
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <div className="bg-white rounded-xl border border-teal-200 shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-bold text-[#44403C]">새 자료 추가</h3>
            <div className="flex gap-2">
              <input
                ref={urlInputRef}
                type="text"
                className={inputClass}
                placeholder="https://youtube.com/watch?v=... 또는 웹사이트 주소"
                value={addUrl}
                onChange={e => setAddUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFetchMeta()}
                disabled={fetching}
              />
              <button
                onClick={handleFetchMeta}
                disabled={fetching || !addUrl.trim()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#EDE8E1] hover:bg-[#E7E5E4] border border-[#E7E5E4] rounded-lg text-[#44403C] transition-colors shrink-0 disabled:opacity-50 min-w-[110px] justify-center"
              >
                {fetching ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs ml-1">분석 중</span></> : '정보 가져오기'}
              </button>
            </div>

            {fetching && fetchStep && (
              <div className="flex items-center gap-2 text-xs text-teal-600 bg-teal-50 rounded-lg px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                {fetchStep}
              </div>
            )}
            {fetchError && <p className="text-xs text-red-500">{fetchError}</p>}

            {/* Thumbnail preview */}
            {addThumbnail && (
              <div className="relative w-full aspect-video max-h-36 rounded-lg overflow-hidden border border-[#EDE8E1] bg-[#EDE8E1]">
                <img src={addThumbnail} alt="썸네일" className="w-full h-full object-cover" />
                <button
                  onClick={() => setAddThumbnail('')}
                  className="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70"
                  title="썸네일 삭제"
                ><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {!addThumbnail && !fetching && addUrl && (
              <button
                onClick={async () => {
                  let url = addUrl.trim();
                  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
                  setFetching(true); setFetchStep('스크린샷 촬영 중...');
                  const shot = await (window.electronAPI as any).screenshotUrl(url);
                  if (shot) setAddThumbnail(shot);
                  setFetching(false); setFetchStep('');
                }}
                className="flex items-center gap-1.5 text-xs text-[#78716C] hover:text-teal-600 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                스크린샷으로 썸네일 만들기
              </button>
            )}

            <input type="text" className={inputClass} placeholder="제목" value={addTitle} onChange={e => setAddTitle(e.target.value)} />
            <textarea className={`${inputClass} min-h-[60px] resize-none`} placeholder="설명 (선택)" value={addDesc} onChange={e => setAddDesc(e.target.value)} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#78716C] mb-1 block">
                  주제(폴더) 선택
                  {addCategory && <span className="ml-1.5 text-teal-600 font-bold">· 자동 분류됨</span>}
                </label>
                <div className="flex gap-2">
                  <select
                    className={inputClass}
                    value={addCategory}
                    onChange={e => { if (e.target.value === '__new__') setShowNewCat(true); else { setAddCategory(e.target.value); setShowNewCat(false); } }}
                  >
                    <option value="">미분류</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__new__">+ 새 주제 만들기</option>
                  </select>
                </div>
                {showNewCat && (
                  <div className="flex gap-1.5 mt-1.5">
                    <input type="text" className={inputClass} placeholder="새 주제 이름" value={newCatInput} onChange={e => setNewCatInput(e.target.value)} />
                    <button
                      onClick={() => { if (newCatInput.trim()) { addCategory_save(newCatInput.trim()); setAddCategory(newCatInput.trim()); setNewCatInput(''); setShowNewCat(false); } }}
                      className="px-2.5 py-1.5 text-xs bg-teal-500 text-white rounded-lg shrink-0 font-semibold"
                    >추가</button>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-[#78716C] mb-1 block">태그 (선택)</label>
                <input type="text" className={inputClass} placeholder="예: 과학 5학년 실험" value={addTags} onChange={e => setAddTags(e.target.value)} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setShowAdd(false); resetForm(); }}
                className="px-4 py-2 text-sm border border-[#E7E5E4] rounded-lg text-[#78716C] hover:bg-[#FAF9F7] transition-colors"
              >취소</button>
              <button
                onClick={handleAdd}
                disabled={!addUrl.trim()}
                className="px-4 py-2 text-sm bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors font-semibold disabled:opacity-50"
              >저장</button>
            </div>
          </div>
        )}

        {/* Category filter tabs */}
        {resources.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {allTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveCategory(tab)}
                className={`shrink-0 px-3 py-1.5 text-sm rounded-full border transition-all font-medium whitespace-nowrap ${
                  activeCategory === tab
                    ? 'bg-teal-500 text-white border-teal-500'
                    : 'bg-white text-[#78716C] border-[#E7E5E4] hover:border-teal-400'
                }`}
              >
                {tab}
                <span className={`ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 ${activeCategory === tab ? 'bg-white/30 text-white' : 'bg-[#EDE8E1] text-[#78716C]'}`}>
                  {tab === '전체' ? resources.length
                    : tab === '미분류' ? resources.filter(r => !r.category).length
                    : resources.filter(r => r.category === tab).length}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        {resources.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]" />
            <input
              type="text"
              className="w-full bg-white rounded-xl border border-[#EDE8E1] text-[#1C1917] text-sm focus:border-teal-500 outline-none pl-9 pr-9 py-2.5 shadow-sm"
              placeholder="제목·설명·태그 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A29E] hover:text-[#78716C]">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Resource cards */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map(r => (
              <div key={r.id} className="bg-white dark:bg-[#221E1B] rounded-xl border border-[#EDE8E1] dark:border-[#2E2822] shadow-sm hover:shadow-md transition-shadow">
                <div className="flex">
                  {/* Thumbnail */}
                  {r.thumbnail ? (
                    <div className="shrink-0 relative overflow-hidden bg-black rounded-l-xl w-36" style={{ minHeight: 80 }}>
                      <img src={r.thumbnail} alt="" className="w-full h-full object-cover" style={{ minHeight: 80 }} />
                      {r.type === 'youtube' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="bg-black/50 rounded-full p-1.5">
                            <Youtube className="w-5 h-5 text-red-500" />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-14 shrink-0 flex items-center justify-center bg-[#FAF9F7] dark:bg-[#2E2822] border-r border-[#EDE8E1] dark:border-[#2E2822] rounded-l-xl">
                      {r.type === 'youtube'
                        ? <Youtube className="w-6 h-6 text-red-300" />
                        : <Globe className="w-6 h-6 text-[#EDE8E1]" />}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 p-3 min-w-0">
                    {editId === r.id ? (
                      <div className="space-y-2">
                        <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full text-sm border border-teal-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-teal-400" />
                        <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full text-xs border border-teal-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-teal-400 resize-none min-h-[50px]" />
                        <div className="flex gap-1.5">
                          <button onClick={() => handleEditSave(r.id)} className="flex items-center gap-1 px-2.5 py-1 text-xs bg-teal-500 text-white rounded hover:bg-teal-600"><Check className="w-3 h-3" />저장</button>
                          <button onClick={() => setEditId(null)} className="px-2.5 py-1 text-xs border border-[#E7E5E4] rounded hover:bg-[#FAF9F7]">취소</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#F0EBE6] leading-snug line-clamp-1">{r.title}</h3>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => { setEditId(r.id); setEditTitle(r.title); setEditDesc(r.description); }} className="p-1 text-[#A8A29E] hover:text-teal-600 rounded transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => window.electronAPI.openExternal(r.url)} className="p-1 text-[#A8A29E] hover:text-blue-600 rounded transition-colors"><ExternalLink className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(r.id)} className="p-1 text-[#A8A29E] hover:text-red-500 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        {r.description && <p className="text-xs text-[#78716C] dark:text-[#9C8F87] leading-relaxed line-clamp-2 mb-1.5">{r.description}</p>}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* 분류 태그 — 클릭하면 드롭다운으로 분류 변경 가능 */}
                          <div className="relative" data-category-dropdown>
                            <button
                              onClick={() => setCategoryEditId(categoryEditId === r.id ? null : r.id)}
                              className={`text-[10px] rounded-full px-2 py-0.5 font-semibold transition-colors cursor-pointer ${
                                r.category
                                  ? 'bg-teal-100 text-teal-700 border border-teal-200 hover:bg-teal-200'
                                  : 'bg-[#EDE8E1] text-[#78716C] border border-[#EDE8E1] hover:bg-[#E7E5E4]'
                              }`}
                              title="클릭하여 분류 변경"
                            >
                              {r.category || '+ 분류'}
                            </button>
                            {categoryEditId === r.id && (
                              <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#2E2822] border border-[#EDE8E1] dark:border-[#2E2822] rounded-lg shadow-lg py-1 min-w-[120px] max-h-[200px] overflow-y-auto">
                                <button
                                  onClick={() => handleCategoryChange(r.id, '')}
                                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#FAF9F7] dark:hover:bg-[#3A332D] ${!r.category ? 'font-bold text-teal-600 bg-teal-50 dark:bg-teal-900/30' : 'text-[#44403C] dark:text-[#C4B8B0]'}`}
                                >
                                  미분류
                                </button>
                                {categories.length > 0 && <div className="border-t border-[#EDE8E1] dark:border-[#2E2822] my-1" />}
                                {categories.map(cat => (
                                  <button
                                    key={cat}
                                    onClick={() => handleCategoryChange(r.id, cat)}
                                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#FAF9F7] dark:hover:bg-[#3A332D] ${r.category === cat ? 'font-bold text-teal-600 bg-teal-50 dark:bg-teal-900/30' : 'text-[#44403C] dark:text-[#C4B8B0]'}`}
                                  >
                                    {cat}
                                  </button>
                                ))}
                                {categories.length === 0 && (
                                  <div className="border-t border-[#EDE8E1] dark:border-[#2E2822] my-1" />
                                )}
                                {categories.length === 0 && (
                                  <button
                                    onClick={() => { setCategoryEditId(null); setShowCatManager(true); }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-teal-600 dark:text-teal-400 hover:bg-[#FAF9F7] dark:hover:bg-[#3A332D]"
                                  >
                                    + 주제 만들기
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-[#A8A29E] truncate max-w-[180px]">{r.url.replace(/^https?:\/\//, '').substring(0, 50)}</span>
                          {r.tags && r.tags.split(/\s+/).filter(Boolean).map((tag, i) => (
                            <span key={i} className="flex items-center gap-0.5 text-[10px] bg-[#EDE8E1] text-[#78716C] rounded-full px-2 py-0.5">
                              <Tag className="w-2.5 h-2.5" />{tag}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#221E1B] rounded-xl border border-dashed border-[#E7E5E4] dark:border-[#2E2822] p-12 flex flex-col items-center justify-center text-center gap-3">
            <BookMarked className="w-14 h-14 text-[#EDE8E1]" />
            <p className="text-sm text-[#A8A29E] whitespace-pre-line">
              {search || activeCategory !== '전체'
                ? '검색 결과가 없습니다.'
                : '아직 저장된 자료가 없습니다.\n위의 추가 버튼으로 자료를 모아보세요.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyResourceLibrary;
