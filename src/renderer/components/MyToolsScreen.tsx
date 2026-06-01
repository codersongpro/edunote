import React, { useState, useEffect } from 'react';
import { CustomTool } from '../types';
import { SAMPLE_TOOLS } from '../data/sampleTools';
import MyToolEditor from './MyToolEditor';
import MyToolRunner from './MyToolRunner';
import MyToolChatCreator from './MyToolChatCreator';
import HtmlAppCreator from './HtmlAppCreator';
import {
  Plus, Play, Pencil, Download, Trash2, Upload, MessageSquare,
  RefreshCw, Share2, AlertCircle, User, X, School, Check, Monitor,
} from 'lucide-react';

type Tab = 'my' | 'market';
type View = 'list' | 'run' | 'edit' | 'edit-html' | 'create-wizard' | 'create-chat' | 'create-html';

// 구글 시트 ID와 폼 URL — 운영 시작 전까지 빈 문자열 유지
const MARKET_SHEET_ID = '1KZNieOfZLlIKUv8xaP2RPUK3fv_g-yIO9h5CijcGTvk';
const MARKET_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdDir228Y5jTgT-0E7gDXyylyaZ4p0z3J-4uRBw7Rk_emD7Yg/viewform';

const CATEGORY_LABELS: Record<string, string> = {
  admin: '교무 행정',
  lesson: '수업 자료',
  student: '학생 기록',
  other: '기타',
};

const CATEGORY_COLORS: Record<string, string> = {
  admin: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  lesson: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  student: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

// 구글 폼 응답 시트 컬럼명 (폼 질문 제목과 일치해야 함)
const COL = {
  timestamp: '타임스탬프',
  name: '도구 이름',
  description: '설명',
  category: '카테고리',
  toolType: '유형',
  author: '작성자',
  authorSchool: '소속',
  message: '한 마디',
  fileUrl: 'JSON 파일',
};

const CATEGORY_MAP: Record<string, CustomTool['category']> = {
  '교무 행정': 'admin',
  '교무행정': 'admin',
  '수업 자료': 'lesson',
  '수업자료': 'lesson',
  '학생 기록': 'student',
  '학생기록': 'student',
  '학생관리': 'student',
  '기타': 'other',
};

// 구글 드라이브 공유 URL → 직접 다운로드 URL 변환
const toDriveDownloadUrl = (url: string): string => {
  const match = url.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  return url;
};

// URL이 실제로 HTTP(S) URL인지 검사 (한글 등 비-URL 값 걸러냄)
const isValidHttpUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

interface MarketEntry {
  name: string;
  description: string;
  category: CustomTool['category'];
  toolType: 'html-app' | 'ai-skill';
  author: string;
  authorSchool: string;
  message: string;
  fileUrl: string;
  createdAt: string;
}

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
};

const parseMarketCsv = (csv: string): { entries: MarketEntry[]; rawHeaders: string[]; totalRows: number } => {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return { entries: [], rawHeaders: [], totalRows: 0 };

  const rawHeaders = parseCsvLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
  const totalRows = lines.length - 1;

  // 정확한 일치 → 없으면 키워드 부분 일치 순서로 컬럼 인덱스 찾기
  const findIdx = (exact: string, ...keywords: string[]): number => {
    let idx = rawHeaders.findIndex(h => h === exact);
    if (idx >= 0) return idx;
    for (const kw of keywords) {
      idx = rawHeaders.findIndex(h => h.toLowerCase().includes(kw.toLowerCase()));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const nameIdx    = findIdx(COL.name,        '이름', 'name', '도구');
  const descIdx    = findIdx(COL.description, '설명', 'desc', '내용');
  const catIdx     = findIdx(COL.category,    '카테고리', 'category', '분류');
  const typeIdx    = findIdx(COL.toolType,    '유형', 'type', 'tooltype');
  const authorIdx  = findIdx(COL.author,      '작성자', 'author');
  const schoolIdx  = findIdx(COL.authorSchool,'소속', 'school', '학교');
  const msgIdx     = findIdx(COL.message,     '한 마디', '메시지', 'message', '소개');
  const fileIdx    = findIdx(COL.fileUrl,     '파일', 'file', 'json', 'url');
  const tsIdx      = findIdx(COL.timestamp,   '타임스탬프', 'timestamp');

  const get = (cols: string[], idx: number): string =>
    idx >= 0 ? (cols[idx] ?? '').replace(/^"|"$/g, '').trim() : '';

  const entries = lines.slice(1).map(line => {
    const cols = parseCsvLine(line);
    const rawUrl = get(cols, fileIdx);
    const cat = get(cols, catIdx);
    const rawType = get(cols, typeIdx).toLowerCase();
    const toolType: MarketEntry['toolType'] =
      (rawType === 'html-app' || rawType === 'html앱' || rawType === 'html 앱' || rawType === '앱') ? 'html-app' : 'ai-skill';
    return {
      name: get(cols, nameIdx),
      description: get(cols, descIdx),
      category: (CATEGORY_MAP[cat] ?? 'other') as CustomTool['category'],
      toolType,
      author: get(cols, authorIdx),
      authorSchool: get(cols, schoolIdx),
      message: get(cols, msgIdx),
      fileUrl: rawUrl ? toDriveDownloadUrl(rawUrl) : '',
      createdAt: get(cols, tsIdx),
    };
  }).filter(e => e.name && e.fileUrl && isValidHttpUrl(e.fileUrl));

  return { entries, rawHeaders, totalRows };
};

const MyToolsScreen: React.FC<{ activeTab?: Tab; onTabChange?: (t: Tab) => void; schoolLevel?: string }> = ({ activeTab = 'my', onTabChange, schoolLevel }) => {
  const [tab, setTab] = useState<Tab>(activeTab);

  useEffect(() => {
    setTab(activeTab);
  }, [activeTab]);
  const [view, setView] = useState<View>('list');
  const [teacherName, setTeacherName] = useState('');
  const [institution, setInstitution] = useState('');

  useEffect(() => {
    (async () => {
      const [name, inst] = await Promise.all([
        window.electronAPI.getConfig('teacherName'),
        window.electronAPI.getConfig('institution'),
      ]);
      if (name) setTeacherName(name as string);
      if (inst) setInstitution(inst as string);
    })();
  }, []);
  const [tools, setTools] = useState<CustomTool[]>([]);
  const [selectedTool, setSelectedTool] = useState<CustomTool | null>(null);
  const [marketEntries, setMarketEntries] = useState<MarketEntry[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState('');
  const [marketDebug, setMarketDebug] = useState<{ headers: string[]; totalRows: number } | null>(null);
  const [importingUrl, setImportingUrl] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState<Omit<CustomTool, 'id' | 'createdAt' | 'updatedAt'> | null>(null);
  const [sharingTool, setSharingTool] = useState<CustomTool | null>(null);

  useEffect(() => {
    (async () => {
      const stored = await window.electronAPI.readJsonData('my-tools') as CustomTool[] | null;
      if (stored && Array.isArray(stored) && stored.length > 0) {
        const newSamples = SAMPLE_TOOLS.filter(s => !stored.some(t => t.id === s.id));
        if (newSamples.length > 0) {
          const merged = [...newSamples, ...stored];
          setTools(merged);
          await window.electronAPI.writeJsonData('my-tools', merged);
        } else {
          setTools(stored);
        }
      } else {
        setTools(SAMPLE_TOOLS);
        await window.electronAPI.writeJsonData('my-tools', SAMPLE_TOOLS);
      }
    })();
  }, []);

  const saveTools = async (updated: CustomTool[]) => {
    setTools(updated);
    await window.electronAPI.writeJsonData('my-tools', updated);
  };

  const handleCreate = (draft: Omit<CustomTool, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const autoAuthor = [teacherName, institution].filter(Boolean).join(' / ') || undefined;
    const tool: CustomTool = { ...draft, id: crypto.randomUUID(), createdAt: now, updatedAt: now, author: draft.author || autoAuthor };
    saveTools([...tools, tool]);
    setView('list');
    setChatDraft(null);
  };

  const handleUpdate = (draft: Omit<CustomTool, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!selectedTool) return;
    const updated = tools.map(t =>
      t.id === selectedTool.id ? { ...t, ...draft, updatedAt: new Date().toISOString() } : t,
    );
    saveTools(updated);
    setView('list');
    setSelectedTool(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 스킬을 삭제할까요?')) return;
    saveTools(tools.filter(t => t.id !== id));
  };

  const handleExport = async (tool: CustomTool) => {
    if (tool.toolType === 'html-app' && tool.htmlContent) {
      await window.electronAPI.exportHtml(tool.htmlContent, `${tool.name}.html`);
    } else {
      const json = JSON.stringify(tool, null, 2);
      await window.electronAPI.saveTxt(json, `${tool.name}.json`);
    }
  };

  const handleImport = async () => {
    const raw = await window.electronAPI.openJsonFile();
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      const items: CustomTool[] = Array.isArray(data) ? data : [data];
      const now = new Date().toISOString();
      const imported = items.map(t => ({
        ...t,
        id: crypto.randomUUID(),
        createdAt: t.createdAt || now,
        updatedAt: now,
      }));
      saveTools([...tools, ...imported]);
      setTab('my');
      onTabChange?.('my');
      alert(`${imported.length}개 스킬을 내 스킬에 추가했습니다.`);
    } catch {
      alert('유효한 스킬 JSON 파일이 아닙니다.');
    }
  };

  const handleImportFromMarket = async (entry: MarketEntry) => {
    if (importingUrl === entry.fileUrl) return;
    setImportingUrl(entry.fileUrl);
    try {
      const raw = await window.electronAPI.fetchUrlJson(entry.fileUrl);
      const data = JSON.parse(raw);
      const items: CustomTool[] = Array.isArray(data) ? data : [data];
      const now = new Date().toISOString();
      const imported = items.map(t => ({ ...t, id: crypto.randomUUID(), updatedAt: now }));
      if (tools.some(t => t.name === imported[0]?.name)) {
        if (!confirm(`"${imported[0]?.name}" 이름의 도구가 이미 있습니다. 추가할까요?`)) return;
      }
      saveTools([...tools, ...imported]);
      setTab('my');
      alert(`"${imported[0]?.name ?? entry.name}" 스킬을 내 스킬에 추가했습니다.`);
    } catch {
      alert('도구를 가져오지 못했습니다.\n파일이 공개 설정인지 확인해 주세요.');
    } finally {
      setImportingUrl(null);
    }
  };

  const loadMarket = async () => {
    if (!MARKET_SHEET_ID) {
      setMarketError('SHEET_ID_EMPTY');
      return;
    }
    setMarketLoading(true);
    setMarketError('');
    setMarketDebug(null);
    try {
      const csv = await window.electronAPI.fetchMarket(MARKET_SHEET_ID);
      const { entries, rawHeaders, totalRows } = parseMarketCsv(csv);
      setMarketEntries(entries);
      if (totalRows > 0) setMarketDebug({ headers: rawHeaders, totalRows });
    } catch (e: any) {
      setMarketError('목록을 불러오지 못했습니다: ' + (e?.message ?? ''));
    } finally {
      setMarketLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'market' && marketEntries.length === 0 && !marketLoading) {
      loadMarket();
    }
  }, [tab]);

  const handleChatComplete = (draft: Omit<CustomTool, 'id' | 'createdAt' | 'updatedAt'>) => {
    setChatDraft(draft);
    setView('create-wizard');
  };

  // ── 뷰 라우팅 ──
  if (view === 'run' && selectedTool) {
    return (
      <MyToolRunner
        tool={selectedTool}
        onBack={() => { setView('list'); setSelectedTool(null); }}
        onEdit={() => setView('edit')}
        schoolLevel={schoolLevel}
      />
    );
  }

  if (view === 'edit' && selectedTool) {
    return (
      <MyToolEditor
        initial={selectedTool}
        onSave={handleUpdate}
        onCancel={() => { setView('list'); setSelectedTool(null); }}
      />
    );
  }

  if (view === 'edit-html' && selectedTool) {
    return (
      <HtmlAppCreator
        initial={selectedTool}
        onSave={handleUpdate}
        onCancel={() => { setView('list'); setSelectedTool(null); }}
      />
    );
  }

  if (view === 'create-wizard') {
    return (
      <MyToolEditor
        initial={chatDraft ? {
          id: '',
          createdAt: '',
          updatedAt: '',
          ...chatDraft,
        } as CustomTool : undefined}
        onSave={handleCreate}
        onCancel={() => { setView('list'); setChatDraft(null); }}
      />
    );
  }

  if (view === 'create-chat') {
    return (
      <MyToolChatCreator
        onComplete={handleChatComplete}
        onCancel={() => setView('list')}
      />
    );
  }

  if (view === 'create-html') {
    return (
      <HtmlAppCreator
        onSave={handleCreate}
        onCancel={() => setView('list')}
      />
    );
  }

  // ── 목록 화면 ──
  return (
    <div className="flex flex-col h-full bg-[#F5F7FA] dark:bg-gray-950">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-extrabold text-gray-900 dark:text-white">AI스킬즈</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">자주 쓰는 AI 패턴을 코드 없이 만들고 동료와 공유하세요</p>
          </div>
          {tab === 'my' && (
            <div className="flex gap-2">
              <button
                onClick={handleImport}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                파일에서 가져오기
              </button>
              <button
                onClick={() => setView('create-chat')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                대화로 만들기
              </button>
              <button
                onClick={() => setView('create-html')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
              >
                <Monitor className="w-3.5 h-3.5" />
                HTML 앱 만들기
              </button>
              <button
                onClick={() => setView('create-wizard')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                새 스킬 만들기
              </button>
            </div>
          )}
        </div>

        {/* 탭 */}
        <div className="flex gap-4 border-b border-gray-100 dark:border-gray-800 -mb-px">
          {([['my', '내 스킬'], ['market', '스킬마켓']] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => { setTab(t); onTabChange?.(t); }}
              className={`flex items-center gap-1.5 pb-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === t
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {t === 'market' && <Share2 className="w-4 h-4" />}
              {label}
              {t === 'my' && <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full">{tools.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {sharingTool && (
        <ShareModal tool={sharingTool} onClose={() => setSharingTool(null)} />
      )}

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'my' && (
          <>
            {tools.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-amber-500" />
                </div>
                <p className="text-base font-bold text-gray-700 dark:text-gray-200 mb-1">아직 만든 스킬이 없어요</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">자주 쓰는 AI 작업을 스킬로 만들어 보세요!</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setView('create-chat')}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-indigo-600 border border-indigo-200 dark:border-indigo-700 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    대화로 만들기
                  </button>
                  <button
                    onClick={() => setView('create-wizard')}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    스킬 만들기
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tools.map(tool => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    onRun={() => { setSelectedTool(tool); setView('run'); }}
                    onEdit={() => { setSelectedTool(tool); setView('edit'); }}
                    onEditHtml={() => { setSelectedTool(tool); setView('edit-html'); }}
                    onExport={() => handleExport(tool)}
                    onDelete={() => handleDelete(tool.id)}
                    onShare={() => setSharingTool(tool)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'market' && (
          <div className="space-y-5">
            {/* 안내 + 버튼 */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                동료 선생님이 공유한 도구를 가져올 수 있습니다.
              </p>
              <div className="flex gap-2">
                {MARKET_FORM_URL && (
                  <button
                    onClick={() => window.electronAPI.openExternal(MARKET_FORM_URL)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-700 rounded-lg hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    내 스킬 공유하기
                  </button>
                )}
                <button
                  onClick={loadMarket}
                  disabled={marketLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${marketLoading ? 'animate-spin' : ''}`} />
                  새로고침
                </button>
              </div>
            </div>

            {/* 준비 중 안내 */}
            {marketError === 'SHEET_ID_EMPTY' && (
              <div className="bg-pink-50 dark:bg-pink-950/30 border border-pink-100 dark:border-pink-800 rounded-xl p-6 text-center space-y-3">
                <Share2 className="w-10 h-10 text-pink-300 dark:text-pink-600 mx-auto" />
                <p className="text-sm font-semibold text-pink-700 dark:text-pink-300">공유 마켓 준비 중</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  곧 오픈됩니다.<br />
                  지금은 아래 방법으로 도구를 주고받을 수 있어요.
                </p>
                <div className="text-left bg-white dark:bg-gray-800 rounded-lg p-4 text-xs text-gray-600 dark:text-gray-300 space-y-2 mt-2">
                  <p className="font-semibold text-gray-700 dark:text-gray-200">📤 도구 보내기</p>
                  <p>도구 만들기 탭 → 도구 카드의 <Download className="w-3 h-3 inline" /> 버튼 → JSON 파일 저장 → 카카오톡·이메일로 전송</p>
                  <p className="font-semibold text-gray-700 dark:text-gray-200 pt-1">📥 도구 받기</p>
                  <p>아래 버튼으로 받은 JSON 파일을 열면 내 도구에 바로 추가됩니다.</p>
                </div>
                <button
                  onClick={handleImport}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-pink-500 hover:bg-pink-600 text-white rounded-xl transition-colors mx-auto"
                >
                  <Upload className="w-4 h-4" />
                  JSON 파일에서 가져오기
                </button>
              </div>
            )}

            {/* 일반 오류 */}
            {marketError && marketError !== 'SHEET_ID_EMPTY' && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {marketError}
              </div>
            )}

            {/* 로딩 */}
            {!marketError && marketLoading && (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">목록을 불러오는 중...</p>
              </div>
            )}

            {/* 목록 */}
            {!marketError && !marketLoading && marketEntries.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {marketEntries.map((entry, i) => (
                  <MarketToolCard
                    key={`${entry.fileUrl}-${i}`}
                    entry={entry}
                    importing={importingUrl === entry.fileUrl}
                    isAdded={tools.some(t => t.name === entry.name)}
                    onImport={() => handleImportFromMarket(entry)}
                  />
                ))}
              </div>
            )}

            {/* 빈 목록 */}
            {!marketError && !marketLoading && marketEntries.length === 0 && MARKET_SHEET_ID && (
              <div className="text-center py-12 text-gray-400 dark:text-gray-600 space-y-2">
                <p className="text-sm font-semibold">아직 공유된 도구가 없습니다.</p>
                <p className="text-xs">첫 번째로 도구를 공유해 보세요!</p>
                {marketDebug && marketDebug.totalRows > 0 && marketEntries.length === 0 && (
                  <div className="mt-4 mx-auto max-w-sm text-left bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">
                      시트에 {marketDebug.totalRows}개 행이 있지만 파싱에 실패했습니다.
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      감지된 열: {marketDebug.headers.join(' / ')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ToolCard: React.FC<{
  tool: CustomTool;
  onRun: () => void;
  onEdit: () => void;
  onEditHtml: () => void;
  onExport: () => void;
  onDelete: () => void;
  onShare: () => void;
}> = ({ tool, onRun, onEdit, onEditHtml, onExport, onDelete, onShare }) => {
  const isHtmlApp = tool.toolType === 'html-app';
  const handleRun = () => {
    if (isHtmlApp && tool.htmlContent) {
      window.electronAPI.openHtmlExternal(tool.htmlContent, tool.name);
    } else {
      onRun();
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition-shadow border-t-2 border ${
      isHtmlApp
        ? 'border-violet-200 dark:border-violet-800/60 border-t-violet-400 dark:border-t-violet-500'
        : 'border-amber-200 dark:border-amber-800/60 border-t-amber-400 dark:border-t-amber-500'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isHtmlApp && <Monitor className="w-3.5 h-3.5 text-violet-500 shrink-0" />}
            <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{tool.name}</h3>
          </div>
          {tool.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{tool.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
            isHtmlApp
              ? 'text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20'
              : 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
          }`}>
            {isHtmlApp ? '앱' : 'AI'}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[tool.category]}`}>
            {CATEGORY_LABELS[tool.category]}
          </span>
        </div>
      </div>

      <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
        {isHtmlApp
          ? <><Monitor className="w-3 h-3 text-violet-400" /> HTML 앱</>
          : `입력 필드 ${tool.inputs.length}개`
        }
      </div>

      <div className={`flex gap-2 pt-1 border-t ${isHtmlApp ? 'border-violet-100 dark:border-violet-900/40' : 'border-amber-100 dark:border-amber-900/40'}`}>
        <button
          onClick={handleRun}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-white text-xs font-bold rounded-lg transition-colors ${isHtmlApp ? 'bg-violet-500 hover:bg-violet-600' : 'bg-amber-500 hover:bg-amber-600'}`}
        >
          {isHtmlApp ? <Monitor className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isHtmlApp ? '열기' : '실행'}
        </button>
        <button
          onClick={isHtmlApp ? onEditHtml : onEdit}
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          수정
        </button>
        <button onClick={onShare} className="p-2 text-gray-400 hover:text-pink-500 transition-colors" title="공유하기">
          <Share2 className="w-4 h-4" />
        </button>
        <button onClick={onExport} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="JSON 내보내기">
          <Download className="w-4 h-4" />
        </button>
        <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="삭제">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const MarketToolCard: React.FC<{
  entry: MarketEntry;
  importing: boolean;
  isAdded: boolean;
  onImport: () => void;
}> = ({ entry, importing, isAdded, onImport }) => (
  <div className={`bg-white dark:bg-gray-900 rounded-xl p-4 flex flex-col gap-3 border-t-2 border ${
    entry.toolType === 'html-app'
      ? 'border-violet-200 dark:border-violet-800/60 border-t-violet-400 dark:border-t-violet-500'
      : 'border-amber-200 dark:border-amber-800/60 border-t-amber-400 dark:border-t-amber-500'
  }`}>
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{entry.name}</h3>
        {entry.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{entry.description}</p>
        )}
        {(entry.author || entry.authorSchool) && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            <User className="w-3 h-3 text-pink-400 dark:text-pink-500 shrink-0" />
            <p className="text-xs text-pink-600 dark:text-pink-400 font-medium">
              {entry.author}{entry.author && entry.authorSchool ? ' · ' : ''}{entry.authorSchool}
            </p>
          </div>
        )}
        {entry.message && (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-1 leading-relaxed line-clamp-2">
            "{entry.message}"
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
          entry.toolType === 'html-app'
            ? 'text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20'
            : 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
        }`}>
          {entry.toolType === 'html-app' ? '앱' : 'AI'}
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[entry.category]}`}>
          {CATEGORY_LABELS[entry.category]}
        </span>
      </div>
    </div>

    <button
      onClick={onImport}
      disabled={importing || isAdded}
      className={`w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-colors ${
        isAdded
          ? 'bg-emerald-500 dark:bg-emerald-600 text-white cursor-default'
          : importing
            ? 'text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-700 opacity-50'
            : 'text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-700 hover:bg-pink-50 dark:hover:bg-pink-900/20'
      }`}
    >
      {importing
        ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />가져오는 중...</>
        : isAdded
          ? <><Check className="w-3.5 h-3.5" />내 스킬에 추가됨</>
          : <><Download className="w-3.5 h-3.5" />내 스킬에 추가</>
      }
    </button>
  </div>
);

const ShareModal: React.FC<{
  tool: CustomTool;
  onClose: () => void;
}> = ({ tool, onClose }) => {
  const [authorName, setAuthorName] = useState(() => localStorage.getItem('share-author-name') || '');
  const [authorSchool, setAuthorSchool] = useState(() => localStorage.getItem('share-author-school') || '');
  const [message, setMessage] = useState('');
  const [jsonSaved, setJsonSaved] = useState(false);

  const isHtmlApp = tool.toolType === 'html-app';
  const handleSaveJson = async () => {
    if (isHtmlApp && tool.htmlContent) {
      await window.electronAPI.exportHtml(tool.htmlContent, `${tool.name}.html`);
    } else {
      const json = JSON.stringify(tool, null, 2);
      await window.electronAPI.saveTxt(json, `${tool.name}.json`);
    }
    localStorage.setItem('share-author-name', authorName);
    localStorage.setItem('share-author-school', authorSchool);
    setJsonSaved(true);
  };

  const handleOpenForm = () => {
    const catFormValues: Record<CustomTool['category'], string> = {
      admin: '교무행정',
      lesson: '수업자료',
      student: '학생관리',
      other: '기타',
    };
    const params = new URLSearchParams();
    params.set('usp', 'pp_url');
    params.set('entry.2111207561', tool.name);
    params.set('entry.1858341623', tool.description);
    params.set('entry.173551723', catFormValues[tool.category] ?? '기타');
    params.set('entry.1451003129', tool.toolType === 'html-app' ? 'HTML 앱' : 'AI 스킬');
    const affiliation = [authorName.trim(), authorSchool.trim()].filter(Boolean).join(' ');
    if (affiliation) params.set('entry.1531111128', affiliation);
    if (message.trim()) params.set('entry.127926671', message.trim());
    window.electronAPI.openExternal(`${MARKET_FORM_URL}?${params.toString()}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col gap-5 p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-pink-500" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">도구 공유하기</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 도구 미리보기 */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{tool.name}</p>
            {tool.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{tool.description}</p>
            )}
          </div>
          <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[tool.category]}`}>
            {CATEGORY_LABELS[tool.category]}
          </span>
        </div>

        {/* 작성자 정보 */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                placeholder="예: 김선생"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">소속 학교</label>
              <input
                value={authorSchool}
                onChange={e => setAuthorSchool(e.target.value)}
                placeholder="예: OO초등학교"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">선생님들께 한 마디</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="도구를 만든 계기나 활용 팁을 알려주세요!"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none"
            />
          </div>
        </div>

        {/* 공유 단계 */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">공유 방법 (2단계)</p>

          {/* 1단계: 파일 저장 */}
          <button
            onClick={handleSaveJson}
            className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              jsonSaved
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700'
                : 'bg-pink-500 hover:bg-pink-600 text-white'
            }`}
          >
            {jsonSaved ? (
              <><span className="text-emerald-500">✓</span> {isHtmlApp ? 'HTML' : 'JSON'} 파일 저장됨</>
            ) : (
              <><Download className="w-4 h-4" /> ① {isHtmlApp ? 'HTML' : 'JSON'} 파일 저장하기</>
            )}
          </button>

          {jsonSaved && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              저장된 {isHtmlApp ? 'HTML' : 'JSON'} 파일을 <strong>구글 드라이브</strong>에 업로드하고,<br />
              파일을 <strong>링크가 있는 모든 사용자</strong>에게 공유한 뒤<br />
              공유 링크를 복사해 폼에 붙여넣어 주세요.
            </div>
          )}

          {/* 2단계: 폼 열기 */}
          <button
            onClick={handleOpenForm}
            disabled={!jsonSaved || !authorName.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-pink-200 dark:border-pink-700 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Share2 className="w-4 h-4" />
            ② 공유 폼에 등록하기
          </button>

          {!jsonSaved && (
            <p className="text-xs text-gray-400 dark:text-gray-600 text-center">① 먼저 JSON 파일을 저장해주세요</p>
          )}
          {jsonSaved && !authorName.trim() && (
            <p className="text-xs text-red-400 text-center">이름을 입력해주세요</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyToolsScreen;
