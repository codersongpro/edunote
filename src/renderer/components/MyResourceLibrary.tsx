import React, { useState, useEffect, useRef } from 'react';
import { BookMarked, Plus, Trash2, ExternalLink, Search, X, Loader2, Youtube, Globe, Tag, Edit2, Check } from 'lucide-react';

interface Resource {
  id: string;
  url: string;
  title: string;
  description: string;
  thumbnail: string;
  type: 'youtube' | 'web';
  tags: string;
  createdAt: number;
}

const STORAGE_KEY = 'eduNote_resources_v1';

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

function isYoutubeUrl(url: string): boolean {
  return !!extractYoutubeId(url);
}

function youtubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function loadResources(): Resource[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveResources(list: Resource[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

const MyResourceLibrary: React.FC = () => {
  const [resources, setResources] = useState<Resource[]>(loadResources);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addTags, setAddTags] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveResources(resources);
  }, [resources]);

  useEffect(() => {
    if (showAdd) setTimeout(() => urlInputRef.current?.focus(), 50);
  }, [showAdd]);

  const handleFetchMeta = async () => {
    if (!addUrl.trim()) return;
    setFetching(true);
    setFetchError('');
    try {
      let urlToParse = addUrl.trim();
      if (!/^https?:\/\//i.test(urlToParse)) urlToParse = 'https://' + urlToParse;

      if (isYoutubeUrl(urlToParse)) {
        const vid = extractYoutubeId(urlToParse)!;
        if (!addTitle) setAddTitle('YouTube 영상');
        if (!addDesc) setAddDesc('');
        setAddUrl(urlToParse);
      } else {
        const meta = await window.electronAPI.fetchUrlMeta(urlToParse);
        if (meta.title && !addTitle) setAddTitle(meta.title);
        if (meta.description && !addDesc) setAddDesc(meta.description);
        setAddUrl(urlToParse);
      }
    } catch {
      setFetchError('주소를 불러오지 못했습니다. 수동으로 입력해주세요.');
    } finally {
      setFetching(false);
    }
  };

  const handleAdd = () => {
    if (!addUrl.trim()) return;
    let url = addUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    const ytId = extractYoutubeId(url);
    const type: Resource['type'] = ytId ? 'youtube' : 'web';
    const thumbnail = ytId ? youtubeThumbnail(ytId) : '';

    const item: Resource = {
      id: Date.now().toString(),
      url,
      title: addTitle || url,
      description: addDesc,
      thumbnail,
      type,
      tags: addTags,
      createdAt: Date.now(),
    };
    setResources(prev => [item, ...prev]);
    setAddUrl(''); setAddTitle(''); setAddDesc(''); setAddTags('');
    setFetchError('');
    setShowAdd(false);
  };

  const handleDelete = (id: string) => {
    setResources(prev => prev.filter(r => r.id !== id));
  };

  const handleEditSave = (id: string) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, title: editTitle, description: editDesc } : r));
    setEditId(null);
  };

  const filtered = resources.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.tags.toLowerCase().includes(q) || r.url.toLowerCase().includes(q);
  });

  const inputClass = 'w-full bg-white rounded-lg border border-gray-300 text-gray-800 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none p-2.5 transition-all';

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA] overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full p-4 space-y-4">

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-teal-100 p-2 rounded-lg">
                <BookMarked className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">나만의 자료실</h2>
                <p className="text-xs text-gray-500">유용한 웹사이트·영상을 한 곳에 모아두세요.</p>
              </div>
            </div>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1.5 px-3 py-2 bg-teal-500 text-white text-sm font-semibold rounded-lg hover:bg-teal-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              추가
            </button>
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="bg-white rounded-xl border border-teal-200 shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-700">새 자료 추가</h3>

            <div className="flex gap-2">
              <input
                ref={urlInputRef}
                type="text"
                className={inputClass}
                placeholder="https://youtube.com/watch?v=... 또는 웹사이트 주소"
                value={addUrl}
                onChange={e => setAddUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFetchMeta()}
              />
              <button
                onClick={handleFetchMeta}
                disabled={fetching || !addUrl.trim()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-gray-700 transition-colors shrink-0 disabled:opacity-50"
              >
                {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : '정보 가져오기'}
              </button>
            </div>

            {fetchError && <p className="text-xs text-red-500">{fetchError}</p>}

            <input type="text" className={inputClass} placeholder="제목" value={addTitle} onChange={e => setAddTitle(e.target.value)} />
            <textarea className={`${inputClass} min-h-[70px] resize-none`} placeholder="설명 (선택)" value={addDesc} onChange={e => setAddDesc(e.target.value)} />
            <input type="text" className={inputClass} placeholder="태그 (선택, 예: 과학 5학년 동영상)" value={addTags} onChange={e => setAddTags(e.target.value)} />

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => { setShowAdd(false); setAddUrl(''); setAddTitle(''); setAddDesc(''); setAddTags(''); setFetchError(''); }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
              <button onClick={handleAdd} disabled={!addUrl.trim()} className="px-4 py-2 text-sm bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors font-semibold disabled:opacity-50">저장</button>
            </div>
          </div>
        )}

        {/* Search */}
        {resources.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="w-full bg-white rounded-xl border border-gray-200 text-gray-800 text-sm focus:border-teal-500 outline-none pl-9 pr-4 py-2.5 shadow-sm"
              placeholder="제목·설명·태그 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Resource cards */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex">
                  {/* Thumbnail */}
                  {r.type === 'youtube' && r.thumbnail ? (
                    <div className="w-36 shrink-0 bg-black relative">
                      <img
                        src={r.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                        style={{ minHeight: 80 }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/50 rounded-full p-1">
                          <Youtube className="w-5 h-5 text-red-500" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-14 shrink-0 flex items-center justify-center bg-gray-50 border-r border-gray-100">
                      <Globe className="w-6 h-6 text-gray-300" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 p-3 min-w-0">
                    {editId === r.id ? (
                      <div className="space-y-2">
                        <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full text-sm border border-teal-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-teal-400" />
                        <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full text-xs border border-teal-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-teal-400 resize-none min-h-[50px]" />
                        <div className="flex gap-1.5">
                          <button onClick={() => handleEditSave(r.id)} className="flex items-center gap-1 px-2 py-1 text-xs bg-teal-500 text-white rounded hover:bg-teal-600"><Check className="w-3 h-3" />저장</button>
                          <button onClick={() => setEditId(null)} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">취소</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-sm font-bold text-gray-800 leading-snug line-clamp-1">{r.title}</h3>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => { setEditId(r.id); setEditTitle(r.title); setEditDesc(r.description); }} className="p-1 text-gray-400 hover:text-teal-600 rounded transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => window.electronAPI.openExternal(r.url)} className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"><ExternalLink className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(r.id)} className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        {r.description && <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-1.5">{r.description}</p>}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{r.url.replace(/^https?:\/\//, '').substring(0, 50)}</span>
                          {r.tags && r.tags.split(/\s+/).filter(Boolean).map((tag, i) => (
                            <span key={i} className="flex items-center gap-0.5 text-[10px] bg-teal-50 text-teal-700 border border-teal-100 rounded-full px-2 py-0.5">
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
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 flex flex-col items-center justify-center text-center gap-3">
            <BookMarked className="w-14 h-14 text-gray-200" />
            <p className="text-sm text-gray-400">
              {search ? '검색 결과가 없습니다.' : '아직 저장된 자료가 없습니다.\n위의 추가 버튼으로 자료를 모아보세요.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyResourceLibrary;
