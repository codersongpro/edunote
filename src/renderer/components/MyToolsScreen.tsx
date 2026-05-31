import React, { useState, useEffect } from 'react';
import { CustomTool } from '../types';
import { SAMPLE_TOOLS } from '../data/sampleTools';
import MyToolEditor from './MyToolEditor';
import MyToolRunner from './MyToolRunner';
import MyToolChatCreator from './MyToolChatCreator';
import {
  Plus, Play, Pencil, Download, Trash2, Upload, MessageSquare,
  ShoppingBag, RefreshCw, Store,
} from 'lucide-react';

type Tab = 'my' | 'market';
type View = 'list' | 'run' | 'edit' | 'create-wizard' | 'create-chat';

const MARKET_SHEET_ID = '';

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

const parseMarketCsv = (csv: string): CustomTool[] => {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const cols = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) ?? [];
    const get = (key: string) => (cols[header.indexOf(key)] ?? '').replace(/^"|"$/g, '').trim();
    let inputs: CustomTool['inputs'] = [];
    try { inputs = JSON.parse(get('inputs_json') || '[]'); } catch { inputs = []; }
    const now = new Date().toISOString();
    return {
      id: get('id') || crypto.randomUUID(),
      name: get('name'),
      description: get('description'),
      category: (get('category') as CustomTool['category']) || 'other',
      author: get('author'),
      inputs,
      promptTemplate: get('promptTemplate'),
      createdAt: get('createdAt') || now,
      updatedAt: now,
    };
  }).filter(t => t.name);
};

const MyToolsScreen: React.FC<{ initialTab?: Tab }> = ({ initialTab = 'my' }) => {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [view, setView] = useState<View>('list');
  const [tools, setTools] = useState<CustomTool[]>([]);
  const [selectedTool, setSelectedTool] = useState<CustomTool | null>(null);
  const [marketTools, setMarketTools] = useState<CustomTool[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState('');
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
      alert(`${imported.length}개 도구를 가져왔습니다.`);
    } catch {
      alert('유효한 도구 JSON 파일이 아닙니다.');
    }
  };

  const handleImportFromMarket = (tool: CustomTool) => {
    const now = new Date().toISOString();
    const imported: CustomTool = { ...tool, id: crypto.randomUUID(), updatedAt: now };
    if (tools.some(t => t.name === tool.name)) {
      if (!confirm(`"${tool.name}" 이름의 도구가 이미 있습니다. 추가할까요?`)) return;
    }
    saveTools([...tools, imported]);
    setTab('my');
    alert(`"${tool.name}" 도구를 내 도구에 추가했습니다.`);
  };

  const loadMarket = async () => {
    if (!MARKET_SHEET_ID) {
      setMarketError('마켓이 아직 준비 중입니다. 곧 오픈 예정!');
      return;
    }
    setMarketLoading(true);
    setMarketError('');
    try {
      const csv = await window.electronAPI.fetchMarket(MARKET_SHEET_ID);
      setMarketTools(parseMarketCsv(csv));
    } catch (e: any) {
      setMarketError('마켓 데이터를 불러오지 못했습니다: ' + (e?.message ?? ''));
    } finally {
      setMarketLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'market' && marketTools.length === 0 && !marketLoading && !marketError) {
      loadMarket();
    }
  }, [tab]);

  const handleChatComplete = (draft: Omit<CustomTool, 'id' | 'createdAt' | 'updatedAt'>) => {
    setChatDraft(draft);
    setView('create-wizard');
  };

  // ── 뷰 라우팅 ──
  if (view === 'run' && selectedTool) {
    return <MyToolRunner tool={selectedTool} onBack={() => { setView('list'); setSelectedTool(null); }} />;
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
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 pb-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === t
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {t === 'market' && <Store className="w-4 h-4" />}
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
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">동료 선생님이 공유한 도구를 가져오거나 커뮤니티 도구를 내려받을 수 있습니다.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  파일에서 가져오기
                </button>
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

            {marketError && (
              <div className="text-center py-16">
                <ShoppingBag className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">{marketError}</p>
              </div>
            )}

            {!marketError && marketLoading && (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">마켓 데이터를 불러오는 중...</p>
              </div>
            )}

            {!marketError && !marketLoading && marketTools.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {marketTools.map(tool => (
                  <MarketToolCard
                    key={tool.id}
                    tool={tool}
                    onImport={() => handleImportFromMarket(tool)}
                  />
                ))}
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
      <button onClick={onEdit} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="수정">
        <Pencil className="w-4 h-4" />
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
  tool: CustomTool;
  onImport: () => void;
}> = ({ tool, onImport }) => (
  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-3">
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{tool.name}</h3>
        {tool.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{tool.description}</p>
        )}
        {tool.author && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">by {tool.author}</p>
        )}
      </div>
      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[tool.category]}`}>
        {CATEGORY_LABELS[tool.category]}
      </span>
    </div>

    <button
      onClick={onImport}
      className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
    >
      <Download className="w-3.5 h-3.5" />
      내 도구에 추가
    </button>
  </div>
);

export default MyToolsScreen;
