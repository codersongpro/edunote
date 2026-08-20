import React, { useEffect, useState } from 'react';
import { Search, Lock } from 'lucide-react';
import { loadStudentCard, StudentCardEntry } from '../lib/studentCard';
import { loadStudentRoster, findRosterMatch, RosterEntry } from '../lib/studentRoster';

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const StudentCardScreen: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<StudentCardEntry[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    loadStudentRoster().then(setRoster);
  }, []);

  const handleSearch = async () => {
    const value = identifier.trim();
    setQuery(value);
    setSearched(true);
    if (!value) { setEntries([]); return; }
    setLoading(true);
    try {
      setEntries(await loadStudentCard(value));
    } finally {
      setLoading(false);
    }
  };

  const rosterMatch = query ? findRosterMatch(roster, query) : null;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#FAF9F7] dark:bg-[#171210]">
      <div className="mx-auto w-full max-w-2xl space-y-4 px-5 py-6">
        <div>
          <h1 className="text-xl font-black text-[#1C1917] dark:text-[#F0EBE6]">학생 카드</h1>
          <p className="mt-0.5 text-sm text-[#78716C] dark:text-[#C4B8B0]">
            행발생성·교과 세특·학교스포츠클럽·창의적 체험활동에서 만든 결과와 학생 메모를 한 곳에서 모아 봅니다. AI를 새로 호출하지 않고, 이미 저장된 내용만 모읍니다.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="생기부 화면에 입력했던 학생 이름/번호/별명을 그대로 입력하세요"
            className="flex-1 px-4 py-2.5 bg-white dark:bg-[#2E2822] border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl text-[#1C1917] dark:text-[#F0EBE6] focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <button
            onClick={handleSearch}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors"
          >
            <Search className="w-4 h-4" />
            찾기
          </button>
        </div>

        {rosterMatch && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              명렬표 매칭: <strong>{rosterMatch.number}번 = {rosterMatch.name}</strong>
              <br />
              이 실명 정보는 이 화면에만(로컬) 표시되며, AI로 전송되지 않습니다.
            </span>
          </div>
        )}

        {loading && (
          <p className="text-sm text-[#78716C] dark:text-[#9C8F87]">불러오는 중...</p>
        )}

        {!loading && searched && entries.length === 0 && (
          <p className="text-sm text-[#78716C] dark:text-[#9C8F87]">
            "{query}"(으)로 저장된 기록이 없습니다. 생기부 화면에서 입력했던 이름/번호/별명과 정확히 같은지 확인해 주세요.
          </p>
        )}

        {entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((entry, idx) => (
              <div
                key={`${entry.kind}-${idx}`}
                className="rounded-xl border border-[#E7E5E4] bg-white p-3.5 dark:border-[#2E2822] dark:bg-[#221E1B]"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                    {entry.label}
                  </span>
                  <span className="text-[11px] text-[#A8A29E]">{formatDate(entry.date)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#1C1917] dark:text-[#C4B8B0]">
                  {entry.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentCardScreen;
