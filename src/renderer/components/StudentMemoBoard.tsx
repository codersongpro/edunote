import React, { useState, useEffect } from 'react';
import { StickyNote, Plus, Trash2, Download, Search } from 'lucide-react';

interface Memo {
  id: string;
  studentName: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  color: string;
}

const COLORS = ['#FFF9C4', '#FCE4EC', '#E8F5E9', '#E3F2FD', '#F3E5F5', '#FFF3E0'];
const STORAGE_KEY = 'eduNote_studentMemos_v1';

const StudentMemoBoard: React.FC = () => {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setMemos(JSON.parse(stored));
    } catch {
      setMemos([]);
    }
  }, []);

  const saveMemos = (updated: Memo[]) => {
    setMemos(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleAdd = () => {
    const newMemo: Memo = {
      id: Date.now().toString(),
      studentName: '',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      color: COLORS[memos.length % COLORS.length],
    };
    saveMemos([newMemo, ...memos]);
    setEditingId(newMemo.id);
    setEditName('');
    setEditContent('');
  };

  const handleEdit = (memo: Memo) => {
    setEditingId(memo.id);
    setEditName(memo.studentName);
    setEditContent(memo.content);
  };

  const handleSave = (id: string) => {
    const updated = memos.map(m =>
      m.id === id ? { ...m, studentName: editName, content: editContent, updatedAt: Date.now() } : m
    );
    saveMemos(updated);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    saveMemos(memos.filter(m => m.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleExportCSV = async () => {
    const header = '학생 이름,메모 내용,작성일,수정일';
    // 편집 중인 메모가 있으면 현재 입력값을 반영
    const exportMemos = memos.map(m =>
      m.id === editingId
        ? { ...m, studentName: editName, content: editContent }
        : m
    );
    const rows = exportMemos.map(m =>
      `"${m.studentName}","${m.content.replace(/"/g, '""')}","${new Date(m.createdAt).toLocaleString('ko-KR')}","${new Date(m.updatedAt).toLocaleString('ko-KR')}"`
    );
    const csv = [header, ...rows].join('\n');
    await window.electronAPI.saveCsv(csv, `학생메모_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const filtered = memos.filter(m =>
    searchQuery === '' ||
    m.studentName.includes(searchQuery) ||
    m.content.includes(searchQuery)
  );

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-100 p-1.5 rounded-lg">
            <StickyNote className="w-4 h-4 text-yellow-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800">학생 메모 보드</h2>
            <p className="text-xs text-gray-500">메모 {memos.length}개 · 앱 재시작 후에도 유지됩니다</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            disabled={memos.length === 0}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            CSV 내보내기
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 text-xs text-white bg-[#1E88E5] hover:bg-[#1565C0] rounded-md px-3 py-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            메모 추가
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="학생 이름 또는 메모 내용으로 검색..."
            className="w-full pl-8 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1E88E5]"
          />
        </div>
      </div>

      {/* Memo Grid */}
      <div
        className="flex-1 overflow-y-auto p-4"
        onDoubleClick={(e) => { if (e.target === e.currentTarget) handleAdd(); }}
      >
        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full text-center"
            onDoubleClick={handleAdd}
          >
            <div className="bg-white p-6 rounded-full shadow-sm mb-4">
              <StickyNote className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-gray-500 font-medium mb-1">메모가 없습니다</h3>
            <p className="text-sm text-gray-400">빈 공간을 더블클릭하면 바로 메모를 추가할 수 있습니다.</p>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
            onDoubleClick={(e) => { if (e.target === e.currentTarget) handleAdd(); }}
          >
            {filtered.map(memo => (
              <div
                key={memo.id}
                className="rounded-lg shadow-sm border border-gray-200 flex flex-col min-h-[160px] cursor-pointer hover:shadow-md transition-shadow"
                style={{ backgroundColor: memo.color }}
                onClick={() => editingId !== memo.id && handleEdit(memo)}
              >
                {editingId === memo.id ? (
                  <div className="p-3 flex flex-col gap-2 h-full" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="학생 이름"
                      className="w-full text-sm font-bold bg-white/60 border border-white/80 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#1E88E5]"
                      autoFocus
                    />
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      placeholder="메모 내용..."
                      className="flex-1 text-xs bg-white/60 border border-white/80 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-[#1E88E5] min-h-[70px]"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleSave(memo.id)}
                        className="flex-1 text-xs bg-[#1E88E5] text-white rounded py-1 hover:bg-[#1565C0]"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => handleDelete(memo.id)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="text-sm font-bold text-gray-800 truncate flex-1">
                        {memo.studentName || '이름 없음'}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(memo.id); }}
                        className="text-gray-400 hover:text-red-500 ml-1 shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-700 flex-1 whitespace-pre-wrap break-words">
                      {memo.content || <span className="text-gray-400 italic">메모 없음</span>}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-2">{formatDate(memo.updatedAt)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentMemoBoard;
