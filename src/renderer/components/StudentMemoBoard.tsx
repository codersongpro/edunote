import React, { useState, useEffect } from 'react';
import { StickyNote, Plus, Trash2, Download, Search } from 'lucide-react';

interface Memo {
  id: string;
  title?: string;
  studentName: string;
  studentNames?: string[];
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
  const [studentFilter, setStudentFilter] = useState('전체');
  const [classStudentNames, setClassStudentNames] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editName, setEditName] = useState('');
  const [editStudentNames, setEditStudentNames] = useState<string[]>([]);
  const [editContent, setEditContent] = useState('');
  const [dataPath, setDataPath] = useState('');

  const getMemoStudents = (memo: Memo): string[] => {
    if (memo.studentNames?.length) return memo.studentNames;
    return memo.studentName ? [memo.studentName] : [];
  };

  const joinStudents = (names: string[]): string => names.join(', ');

  const parseNames = (value: string): string[] =>
    value.split(/[\n,]+/).map(name => name.trim()).filter(Boolean);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [fileData, filePath] = await Promise.all([
          window.electronAPI.readJsonData('student-memos'),
          window.electronAPI.getJsonDataPath('student-memos'),
        ]);
        if (cancelled) return;
        setDataPath(filePath);
        if (Array.isArray(fileData)) {
          setMemos(fileData as Memo[]);
          return;
        }
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setMemos(parsed);
          window.electronAPI.writeJsonData('student-memos', parsed).catch(() => {});
        }
      } catch {
        setMemos([]);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    window.electronAPI.getConfig('studentNames')
      .then(value => setClassStudentNames(parseNames(String(value || ''))))
      .catch(() => setClassStudentNames([]));
  }, []);

  const saveMemos = (updated: Memo[]) => {
    setMemos(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.electronAPI.writeJsonData('student-memos', updated).catch(() => {});
  };

  const handleAdd = () => {
    const newMemo: Memo = {
      id: Date.now().toString(),
      studentName: '',
      studentNames: [],
      title: '',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      color: COLORS[memos.length % COLORS.length],
    };
    saveMemos([newMemo, ...memos]);
    setEditingId(newMemo.id);
    setEditTitle('');
    setEditName('');
    setEditStudentNames([]);
    setEditContent('');
  };

  const handleEdit = (memo: Memo) => {
    setEditingId(memo.id);
    setEditTitle(memo.title || '');
    const students = getMemoStudents(memo);
    setEditStudentNames(students);
    setEditName(joinStudents(students));
    setEditContent(memo.content);
  };

  const handleSave = (id: string) => {
    const names = editStudentNames.length > 0 ? editStudentNames : parseNames(editName);
    const updated = memos.map(m =>
      m.id === id ? { ...m, title: editTitle, studentName: joinStudents(names), studentNames: names, content: editContent, updatedAt: Date.now() } : m
    );
    saveMemos(updated);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const memo = memos.find(m => m.id === id);
    // 내용이 있는 메모는 실수 삭제를 막기 위해 확인을 받음
    const hasContent = !!(memo && ((memo.title || '').trim() || getMemoStudents(memo).length > 0 || memo.content.trim()));
    if (hasContent && !window.confirm('이 메모를 삭제할까요? 삭제하면 되돌릴 수 없습니다.')) return;
    saveMemos(memos.filter(m => m.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleExportCSV = async () => {
    const header = '제목,학생 이름,메모 내용,작성일,수정일';
    // 편집 중인 메모가 있으면 현재 입력값을 반영
    const exportMemos = memos.map(m =>
      m.id === editingId
        ? {
            ...m,
            title: editTitle,
            studentName: joinStudents(editStudentNames.length > 0 ? editStudentNames : parseNames(editName)),
            studentNames: editStudentNames.length > 0 ? editStudentNames : parseNames(editName),
            content: editContent,
          }
        : m
    );
    const rows = exportMemos.map(m =>
      `"${(m.title || '').replace(/"/g, '""')}","${joinStudents(getMemoStudents(m)).replace(/"/g, '""')}","${m.content.replace(/"/g, '""')}","${new Date(m.createdAt).toLocaleString('ko-KR')}","${new Date(m.updatedAt).toLocaleString('ko-KR')}"`
    );
    const csv = [header, ...rows].join('\n');
    await window.electronAPI.saveCsv(csv, `학생메모_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const allStudentOptions = Array.from(new Set([
    ...classStudentNames,
    ...memos.flatMap(getMemoStudents),
  ])).filter(Boolean);

  const filtered = memos.filter(m => {
    const students = getMemoStudents(m);
    const matchesStudent = studentFilter === '전체' || students.includes(studentFilter);
    if (!matchesStudent) return false;
    return searchQuery === '' ||
      (m.title || '').includes(searchQuery) ||
      joinStudents(students).includes(searchQuery) ||
      m.content.includes(searchQuery);
  });

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF9F7]">
      {/* Header */}
      <div className="bg-white dark:bg-[#221E1B] border-b border-[#EDE8E1] dark:border-[#2E2822] px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-100 p-1.5 rounded-lg">
            <StickyNote className="w-4 h-4 text-yellow-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#F0EBE6]">학생 메모 보드</h2>
            <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">메모 {memos.length}개 · {dataPath ? '지정 폴더에 자동 저장됨' : '앱 재시작 후에도 유지됩니다'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            disabled={memos.length === 0}
            className="flex items-center gap-1 text-xs text-[#78716C] dark:text-[#9C8F87] hover:text-[#44403C] dark:hover:text-[#C4B8B0] border border-[#EDE8E1] dark:border-[#2E2822] rounded-md px-3 py-1.5 hover:bg-[#FAF9F7] dark:hover:bg-[#2E2822] disabled:opacity-40 disabled:cursor-not-allowed"
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
      <div className="bg-white dark:bg-[#221E1B] border-b border-[#EDE8E1] dark:border-[#2E2822] px-4 py-2 shrink-0">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A8A29E]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목, 학생 이름, 내용으로 검색..."
              className="w-full pl-8 pr-4 py-2 text-sm bg-[#FAF9F7] dark:bg-[#2E2822] border border-[#EDE8E1] dark:border-[#2E2822] dark:text-[#F0EBE6] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1E88E5] dark:placeholder-[#6B5E57]"
            />
          </div>
          <select
            value={studentFilter}
            onChange={e => setStudentFilter(e.target.value)}
            className="w-40 px-3 py-2 text-sm bg-[#FAF9F7] dark:bg-[#2E2822] border border-[#EDE8E1] dark:border-[#2E2822] dark:text-[#F0EBE6] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1E88E5]"
          >
            <option value="전체">전체 학생</option>
            {allStudentOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
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
            <div className="bg-white dark:bg-[#221E1B] p-6 rounded-full shadow-sm mb-4">
              <StickyNote className="w-10 h-10 text-[#EDE8E1]" />
            </div>
            <h3 className="text-[#78716C] dark:text-[#9C8F87] font-medium mb-1">메모가 없습니다</h3>
            <p className="text-sm text-[#A8A29E] dark:text-[#6B5E57]">빈 공간을 더블클릭하면 바로 메모를 추가할 수 있습니다.</p>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
            onDoubleClick={(e) => { if (e.target === e.currentTarget) handleAdd(); }}
          >
            {filtered.map(memo => (
              <div
                key={memo.id}
                className="rounded-lg shadow-sm border border-[#E7E5E4] dark:border-[#2E2822] flex flex-col min-h-[160px] cursor-pointer hover:shadow-md transition-shadow"
                style={{ backgroundColor: memo.color }}
                onClick={() => editingId !== memo.id && handleEdit(memo)}
              >
                {editingId === memo.id ? (
                  <div className="p-3 flex flex-col gap-2 h-full" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      placeholder="제목"
                      className="w-full text-sm font-bold bg-white/75 border border-white/80 rounded px-2 py-1 text-[#1C1917] placeholder-[#78716C] focus:outline-none focus:ring-1 focus:ring-[#1E88E5]"
                      autoFocus
                    />
                    {classStudentNames.length > 0 ? (
                      <div className="max-h-20 overflow-y-auto bg-white/60 border border-white/80 rounded px-2 py-1">
                        <p className="text-[10px] font-bold text-[#78716C] mb-1">우리반 학생 이름</p>
                        <div className="flex flex-wrap gap-1">
                          {classStudentNames.map(name => {
                            const selected = editStudentNames.includes(name);
                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => {
                                  setEditStudentNames(prev => selected ? prev.filter(n => n !== name) : [...prev, name]);
                                  setEditName('');
                                }}
                                className={`text-[11px] rounded-full px-2 py-0.5 border ${selected ? 'bg-[#1E88E5] text-white border-[#1E88E5]' : 'bg-white/80 text-[#44403C] border-white'}`}
                              >
                                {name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={editName}
                        onChange={e => { setEditName(e.target.value); setEditStudentNames(parseNames(e.target.value)); }}
                        placeholder="학생 이름 (쉼표로 여러 명 입력)"
                        className="w-full text-xs bg-white/75 border border-white/80 rounded px-2 py-1 text-[#1C1917] placeholder-[#78716C] focus:outline-none focus:ring-1 focus:ring-[#1E88E5]"
                      />
                    )}
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      placeholder="내용..."
                      className="flex-1 text-xs bg-white/75 border border-white/80 rounded px-2 py-1 resize-none text-[#1C1917] placeholder-[#78716C] focus:outline-none focus:ring-1 focus:ring-[#1E88E5] min-h-[70px]"
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
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#1C1917] truncate">{memo.title || '제목 없음'}</p>
                        <p className="text-[11px] text-[#78716C] truncate">{joinStudents(getMemoStudents(memo)) || '학생 미선택'}</p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(memo.id); }}
                        className="text-[#A8A29E] hover:text-red-500 ml-1 shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-xs text-[#1C1917] flex-1 whitespace-pre-wrap break-words">
                      {memo.content || <span className="text-[#A8A29E] italic">메모 없음</span>}
                    </p>
                    <p className="text-[10px] text-[#78716C] mt-2">{formatDate(memo.updatedAt)}</p>
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
