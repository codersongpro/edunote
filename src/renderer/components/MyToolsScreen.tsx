import React, { useState, useEffect } from 'react';
import { CustomTool } from '../types';
import { SAMPLE_TOOLS } from '../data/sampleTools';
import MyToolEditor from './MyToolEditor';
import MyToolRunner from './MyToolRunner';
import MyToolChatCreator from './MyToolChatCreator';
import {
  Plus, Play, Pencil, Download, Trash2, Upload, MessageSquare,
  RefreshCw, Share2, AlertCircle,
} from 'lucide-react';

type Tab = 'my' | 'market';
type View = 'list' | 'run' | 'edit' | 'create-wizard' | 'create-chat';

// 구글 시트 ID와 폼 URL — 운영 시작 전까지 빈 문자열 유지
const MARKET_SHEET_ID = '1yHUDpzR_BfPwm7xflRJuQysqknQnNZve0BhAOEazfTo';
const MARKET_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdDir228Y5jTgT-0E7gDXyylyaZ4p0z3J-4uRBw7Rk_emD7Yg/viewform';

const CATEGORY_LABELS: Record<string, string> = {
  admin: '학급 행정',
  lesson: '수업 자료',
  student: '학생 관리',
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
  author: '작성자',
  fileUrl: 'JSON 파일',
};

const CATEGORY_MAP: Record<string, CustomTool['category']> = {
  '학급 행정': 'admin',
  '수업 자료': 'lesson',
  '학생 관리': 'student',
  '기타': 'other',
};

// 구글 드라이브 공유 URL → 직접 다운로드 URL 변환
const toDriveDownloadUrl = (url: string): string => {
  const match = url.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  return url;
};

interface MarketEntry {
  name: string;
  description: string;
  category: CustomTool['category'];
  author: string;
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

  const nameIdx   = findIdx(COL.name,   '이름', 'name', '도구');
  const descIdx   = findIdx(COL.description, '설명', 'desc', '내용');
  const catIdx    = findIdx(COL.category,    '카테고리', 'category', '분류');
  const authorIdx = findIdx(COL.author,      '작성자', 'author');
  const fileIdx   = findIdx(COL.fileUrl,     '파일', 'file', 'json', 'url');
  const tsIdx     = findIdx(COL.timestamp,   '타임스탬프', 'timestamp');

  const get = (cols: string[], idx: number): string =>
    idx >= 0 ? (cols[idx] ?? '').replace(/^"|"$/g, '').trim() : '';

  const entries = lines.slice(1).map(line => {
    const cols = parseCsvLine(line);
    const rawUrl = get(cols, fileIdx);
    const cat = get(cols, catIdx);
    return {
      name: get(cols, nameIdx),
      description: get(cols, descIdx),
      category: (CATEGORY_MAP[cat] ?? 'other') as CustomTool['category'],
      author: get(cols, authorIdx),
      fileUrl: rawUrl ? toDriveDownloadUrl(rawUrl) : '',
      createdAt: get(cols, tsIdx),
    };
  }).filter(e => e.name && e.fileUrl);

  return { entries, rawHeaders, totalRows };
};

const MyToolsScreen: React.FC<{ activeTab?: Tab; onTabChange?: (t: Tab) => void }> = ({ activeTab = 'my', onTabChange }) => {
  const [tab, setTab] = useState<Tab>(activeTab);

  useEffect(() => {
    setTab(activeTab);
  }, [activeTab]);
  const [view, setView] = useState<View>('list');
  const [tools, setTools] = useState<CustomTool[]>([]);
  const [selectedTool, setSelectedTool] = useState<CustomTool | null>(null);
  const [marketEntries, setMarketEntries] = useState<MarketEntry[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState('');
  const [marketDebug, setMarketDebug] = useState<{ headers: string[]; totalRows: number } | null>(null);
  const [importingUrl, setImportingUrl] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState<Omit<CustomTool, 'id' | 'createdAt' | 'updatedAt'> | null>(null);

  useEffect(() => {
    (async () => {
      const stored = await window.electronAPI.readJsonData('my-tools') as CustomTool[] | null;
      if (stored && Array.isArray(stored) && stored.length > 0) {
        setTools(stored);
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
    const tool: CustomTool = { ...draft, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
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
    if (!confirm('이 도구를 삭제할까요?')) return;
    saveTools(tools.filter(t => t.id !== id));
  };

  const handleExport = async (tool: CustomTool) => {
    const json = JSON.stringify(tool, null, 2);
    await window.electronAPI.saveTxt(json, `${tool.name}.json`);
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
      alert(`${imported.length}개 도구를 내 도구에 추가했습니다.`);
    } catch {
      alert('유효한 도구 JSON 파일이 아닙니다.');
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
      alert(`"${imported[0]?.name ?? entry.name}" 도구를 내 도구에 추가했습니다.`);
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
    if (tab === 'market' && marketEntries.length === 0 && !marketLoading && !marketError) {
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

  // ── 목록 화면 ──
  return (
    <div className="flex flex-col h-full bg-[#F5F7FA] dark:bg-gray-950">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-extrabold text-gray-900 dark:text-white">나만의 AI 도구</h1>
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
                onClick={() => setView('create-wizard')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                새 도구 만들기
              </button>
            </div>
          )}
        </div>

        {/* 탭 */}
        <div className="flex gap-4 border-b border-gray-100 dark:border-gray-800 -mb-px">
          {([['my', '내 도구'], ['market', '공유받은 도구']] as [Tab, string][]).map(([t, label]) => (
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

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'my' && (
          <>
            {tools.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-amber-500" />
                </div>
                <p className="text-base font-bold text-gray-700 dark:text-gray-200 mb-1">아직 만든 도구가 없어요</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">자주 쓰는 AI 작업을 도구로 만들어 보세요!</p>
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
                    직접 만들기
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
                    onExport={() => handleExport(tool)}
                    onDelete={() => handleDelete(tool.id)}
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
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    내 도구 공유하기
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
              <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-800 rounded-xl p-6 text-center space-y-3">
                <Share2 className="w-10 h-10 text-violet-300 dark:text-violet-600 mx-auto" />
                <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">공유 마켓 준비 중</p>
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
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-violet-500 hover:bg-violet-600 text-white rounded-xl transition-colors mx-auto"
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
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
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
  onExport: () => void;
  onDelete: () => void;
}> = ({ tool, onRun, onEdit, onExport, onDelete }) => (
  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{tool.name}</h3>
        {tool.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{tool.description}</p>
        )}
      </div>
      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[tool.category]}`}>
        {CATEGORY_LABELS[tool.category]}
      </span>
    </div>

    <div className="text-xs text-gray-400 dark:text-gray-500">
      입력 필드 {tool.inputs.length}개
    </div>

    <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
      <button
        onClick={onRun}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors"
      >
        <Play className="w-3.5 h-3.5" />
        실행
      </button>
      <button
        onClick={onEdit}
        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
        수정
      </button>
      <button onClick={onExport} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="내보내기">
        <Download className="w-4 h-4" />
      </button>
      <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="삭제">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const MarketToolCard: React.FC<{
  entry: MarketEntry;
  importing: boolean;
  onImport: () => void;
}> = ({ entry, importing, onImport }) => (
  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-3">
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{entry.name}</h3>
        {entry.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{entry.description}</p>
        )}
        {entry.author && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">by {entry.author}</p>
        )}
      </div>
      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[entry.category]}`}>
        {CATEGORY_LABELS[entry.category]}
      </span>
    </div>

    <button
      onClick={onImport}
      disabled={importing}
      className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-50"
    >
      {importing
        ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />가져오는 중...</>
        : <><Download className="w-3.5 h-3.5" />내 도구에 추가</>
      }
    </button>
  </div>
);

export default MyToolsScreen;
