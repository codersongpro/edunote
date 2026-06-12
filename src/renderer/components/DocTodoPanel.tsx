import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckSquare, ListTodo, Plus, Square, Trash2 } from 'lucide-react';

// 공문에서 추출하거나 직접 입력한 할 일.
// 데이터는 앱 데이터 폴더의 doc-todos.json에 저장한다 (백업에 자동 포함).
export interface DocTodo {
  id: string;
  title: string;
  deadline: string; // YYYY-MM-DD, 없으면 ''
  memo: string;
  done: boolean;
  createdAt: string;
}

const DATA_NAME = 'doc-todos';

export async function loadDocTodos(): Promise<DocTodo[]> {
  try {
    const data = await window.electronAPI.readJsonData(DATA_NAME);
    return Array.isArray(data) ? (data as DocTodo[]) : [];
  } catch {
    return [];
  }
}

export async function saveDocTodos(todos: DocTodo[]): Promise<void> {
  await window.electronAPI.writeJsonData(DATA_NAME, todos);
}

// 마감일까지 남은 일수. 마감일이 없으면 null.
export function daysUntil(deadline: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const due = new Date(Number(deadline.slice(0, 4)), Number(deadline.slice(5, 7)) - 1, Number(deadline.slice(8, 10)));
  return Math.round((due.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function dDayBadge(deadline: string): { label: string; className: string } | null {
  const days = daysUntil(deadline);
  if (days === null) return null;
  if (days < 0) return { label: `D+${-days}`, className: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' };
  if (days === 0) return { label: 'D-DAY', className: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' };
  if (days <= 3) return { label: `D-${days}`, className: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' };
  return { label: `D-${days}`, className: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' };
}

const DocTodoPanel: React.FC = () => {
  const [todos, setTodos] = useState<DocTodo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDeadline, setNewDeadline] = useState('');

  useEffect(() => {
    loadDocTodos().then(items => {
      setTodos(items);
      setLoaded(true);
    });
  }, []);

  const update = async (next: DocTodo[]) => {
    setTodos(next);
    await saveDocTodos(next);
  };

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    const todo: DocTodo = {
      id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      deadline: newDeadline,
      memo: '',
      done: false,
      createdAt: new Date().toISOString(),
    };
    await update([...todos, todo]);
    setNewTitle('');
    setNewDeadline('');
  };

  const handleToggle = (id: string) => update(todos.map(t => (t.id === id ? { ...t, done: !t.done } : t)));

  const handleDelete = (id: string) => update(todos.filter(t => t.id !== id));

  // 미완료(마감 빠른 순) → 완료 순으로 보여준다. 마감 없는 항목은 미완료 뒤쪽.
  const sorted = [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (!a.deadline && !b.deadline) return a.createdAt.localeCompare(b.createdAt);
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  });

  const remaining = todos.filter(t => !t.done).length;

  return (
    <div className="h-full overflow-y-auto bg-[#FAF9F7] dark:bg-[#171210] p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <ListTodo className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1C1917] dark:text-[#F0EBE6]">공문 할일</h2>
            <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">
              공문요약·업무추출에서 저장한 할 일과 직접 추가한 할 일을 마감일 순으로 관리합니다.
              {remaining > 0 && ` 남은 할 일 ${remaining}건`}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#221E1B] rounded-xl border border-[#EDE8E1] dark:border-[#2E2822] p-4 flex flex-wrap items-center gap-2">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#171210] text-sm text-[#1C1917] dark:text-[#F0EBE6] outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="할 일 내용 (예: 학교자율시간 운영 자료 제출)"
          />
          <input
            type="date"
            value={newDeadline}
            onChange={e => setNewDeadline(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#171210] text-sm text-[#1C1917] dark:text-[#F0EBE6] outline-none focus:ring-2 focus:ring-emerald-500"
            title="마감일 (선택)"
          />
          <button
            onClick={handleAdd}
            disabled={!newTitle.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-[#E7E5E4] dark:disabled:bg-[#2E2822] text-white text-sm font-bold transition-colors"
          >
            <Plus className="w-4 h-4" />
            추가
          </button>
        </div>

        {loaded && sorted.length === 0 && (
          <div className="text-center py-16 text-[#A8A29E] dark:text-[#6B5E57]">
            <ListTodo className="w-10 h-10 mx-auto mb-3 opacity-60" />
            <p className="text-sm font-semibold">아직 할 일이 없습니다.</p>
            <p className="text-xs mt-1">공문요약·업무추출 화면에서 "할일로 저장"을 누르거나 위에서 직접 추가하세요.</p>
          </div>
        )}

        <div className="space-y-2">
          {sorted.map(todo => {
            const badge = todo.deadline ? dDayBadge(todo.deadline) : null;
            return (
              <div
                key={todo.id}
                className={`bg-white dark:bg-[#221E1B] rounded-xl border border-[#EDE8E1] dark:border-[#2E2822] p-3.5 flex items-start gap-3 ${todo.done ? 'opacity-60' : ''}`}
              >
                <button
                  onClick={() => handleToggle(todo.id)}
                  className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0"
                  title={todo.done ? '미완료로 되돌리기' : '완료로 표시'}
                >
                  {todo.done ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold text-[#1C1917] dark:text-[#F0EBE6] break-words ${todo.done ? 'line-through' : ''}`}>
                    {todo.title}
                  </p>
                  {todo.memo && (
                    <p className="text-xs text-[#78716C] dark:text-[#9C8F87] mt-1 whitespace-pre-wrap break-words">{todo.memo}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    {todo.deadline && (
                      <span className="inline-flex items-center gap-1 text-xs text-[#78716C] dark:text-[#9C8F87]">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {todo.deadline}
                      </span>
                    )}
                    {!todo.done && badge && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.className}`}>{badge.label}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(todo.id)}
                  className="p-1.5 text-[#A8A29E] dark:text-[#6B5E57] hover:text-red-600 dark:hover:text-red-400 shrink-0"
                  title="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DocTodoPanel;
