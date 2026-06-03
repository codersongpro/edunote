import React, { useState, useEffect } from 'react';
import { Archive, Plus, Trash2, Search, X, FileText, Image as ImageIcon, Tag, ChevronDown } from 'lucide-react';
import { FileUpload } from './FileUpload';
import { FileData } from '../types';

interface DocArchiveItem {
  id: string;
  title: string;
  date: string;
  category: string;
  captureBase64?: string;
  captureMimeType?: string;
  attachments: { name: string; base64: string; mimeType: string }[];
  memo: string;
  createdAt: number;
}

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';
const labelClass = 'block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1';

const CATEGORIES = ['안전', '연수', '행사', '공문', '방역', '업무', '기타'];

export default function DocArchivePanel() {
  const [items, setItems] = useState<DocArchiveItem[]>([]);
  const [view, setView] = useState<'list' | 'add' | 'detail'>('list');
  const [selected, setSelected] = useState<DocArchiveItem | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('전체');

  // 추가 폼 상태
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toLocaleDateString('ko-KR'));
  const [category, setCategory] = useState('공문');
  const [memo, setMemo] = useState('');
  const [captureFiles, setCaptureFiles] = useState<FileData[]>([]);
  const [attachFiles, setAttachFiles] = useState<FileData[]>([]);

  useEffect(() => {
    window.electronAPI.readJsonData('doc-archive')
      .then((data: unknown) => setItems(Array.isArray(data) ? (data as DocArchiveItem[]) : []))
      .catch(() => setItems([]));
  }, []);

  const save = async (updated: DocArchiveItem[]) => {
    setItems(updated);
    await window.electronAPI.writeJsonData('doc-archive', updated);
  };

  const handleAdd = async () => {
    if (!title.trim()) { alert('제목을 입력하세요.'); return; }
    const capture = captureFiles[0];
    const item: DocArchiveItem = {
      id: crypto.randomUUID(),
      title: title.trim(),
      date,
      category,
      captureBase64: capture?.base64,
      captureMimeType: capture?.mimeType,
      attachments: attachFiles.map(f => ({ name: f.file.name, base64: f.base64, mimeType: f.mimeType })),
      memo: memo.trim(),
      createdAt: Date.now(),
    };
    await save([item, ...items]);
    setView('list');
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('삭제할까요?')) return;
    await save(items.filter(i => i.id !== id));
    if (selected?.id === id) { setSelected(null); setView('list'); }
  };

  const resetForm = () => {
    setTitle(''); setDate(new Date().toLocaleDateString('ko-KR')); setCategory('공문'); setMemo('');
    setCaptureFiles([]); setAttachFiles([]);
  };

  const filtered = items.filter(item => {
    const matchSearch = !search || item.title.toLowerCase().includes(search.toLowerCase()) || item.memo.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === '전체' || item.category === filterCat;
    return matchSearch && matchCat;
  });

  if (view === 'add') {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
        <div className="shrink-0 px-5 pt-4 pb-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <button
            onClick={() => { setView('list'); resetForm(); }}
            className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
          >
            <X className="w-4 h-4" /> 취소
          </button>
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">공문 저장</h2>
          <button
            onClick={handleAdd}
            className="ml-auto px-4 py-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
          >
            저장
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4 max-w-2xl w-full mx-auto">
          <div>
            <label className={labelClass}>제목 <span className="text-red-500">*</span></label>
            <input className={inputClass} value={title} onChange={e => setTitle(e.target.value)} placeholder="공문 제목을 입력하세요" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>날짜</label>
              <input className={inputClass} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>분류</label>
              <select className={inputClass} value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <FileUpload
            label="공문 캡처 이미지 (Ctrl+V 붙여넣기 또는 파일 선택)"
            files={captureFiles}
            onFilesChange={setCaptureFiles}
            accept=".jpg,.jpeg,.png,.gif,.webp"
            multiple={false}
            globalPaste={true}
          />
          <FileUpload
            label="붙임문서 첨부 (여러 파일 선택 가능)"
            files={attachFiles}
            onFilesChange={setAttachFiles}
            accept=".pdf,.hwp,.hwpx,.docx,.xlsx,.jpg,.jpeg,.png,.txt"
            multiple={true}
          />
          <div>
            <label className={labelClass}>메모</label>
            <textarea className={inputClass} rows={3} value={memo} onChange={e => setMemo(e.target.value)} placeholder="추가 메모 (선택)" />
          </div>
        </div>
      </div>
    );
  }

  if (view === 'detail' && selected) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
        <div className="shrink-0 px-5 pt-4 pb-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <button onClick={() => setView('list')} className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1">
            <ChevronDown className="w-4 h-4 rotate-90" /> 목록으로
          </button>
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 truncate flex-1">{selected.title}</h2>
          <button onClick={() => handleDelete(selected.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
            <Trash2 className="w-4 h-4" /> 삭제
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4 max-w-2xl w-full mx-auto">
          <div className="flex gap-3 text-sm">
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">{selected.category}</span>
            <span className="text-gray-500 dark:text-gray-400">{selected.date}</span>
          </div>
          {selected.captureBase64 && (
            <div>
              <p className={labelClass}>캡처 이미지</p>
              <img src={`data:${selected.captureMimeType};base64,${selected.captureBase64}`} alt="공문 캡처" className="max-w-full rounded-lg border border-gray-200 dark:border-gray-700 shadow" />
            </div>
          )}
          {selected.attachments.length > 0 && (
            <div>
              <p className={labelClass}>붙임문서 ({selected.attachments.length}개)</p>
              <div className="space-y-1">
                {selected.attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">
                    <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="truncate text-gray-700 dark:text-gray-300">{att.name}</span>
                    <button
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = `data:${att.mimeType};base64,${att.base64}`;
                        a.download = att.name;
                        a.click();
                      }}
                      className="ml-auto text-xs text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                    >
                      다운로드
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {selected.memo && (
            <div>
              <p className={labelClass}>메모</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">{selected.memo}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* 헤더 */}
      <div className="shrink-0 px-5 pt-5 pb-3 flex items-center gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Archive className="w-5 h-5 text-emerald-500" />
            공문 보관함
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">공문 캡처 이미지와 붙임문서를 저장·관리합니다.</p>
        </div>
        <button
          onClick={() => setView('add')}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          공문 저장
        </button>
      </div>

      {/* 검색/필터 */}
      <div className="shrink-0 px-5 pb-3 flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="제목·메모 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {['전체', ...CATEGORIES].map(c => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filterCat === c
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-600">
            <Archive className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm font-semibold">저장된 공문이 없습니다.</p>
            <p className="text-xs mt-1">"공문 저장" 버튼으로 추가하세요.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => (
              <div
                key={item.id}
                onClick={() => { setSelected(item); setView('detail'); }}
                className="flex items-center gap-3 p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 cursor-pointer transition-all group"
              >
                {item.captureBase64 ? (
                  <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                    <img src={`data:${item.captureMimeType};base64,${item.captureBase64}`} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                    <FileText className="w-5 h-5 text-emerald-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">{item.category}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{item.date}</span>
                    {item.attachments.length > 0 && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
                        <Tag className="w-3 h-3" /> 붙임 {item.attachments.length}개
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
