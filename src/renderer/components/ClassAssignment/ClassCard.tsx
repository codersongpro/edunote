import React, { useState } from 'react';
import { Lock, Unlock, Ban } from 'lucide-react';
import { classLabel } from '../../lib/classAssignment/criteria';
import type { ClassStat } from '../../lib/classAssignment/metrics';
import type { ClassLabelStyle, ClassStudent } from '../../lib/classAssignment/types';
import { card, muted, strong } from './ui';

interface Props {
  stat: ClassStat;
  students: ClassStudent[];
  numClasses: number;
  labelStyle: ClassLabelStyle;
  academicText: string;
  locks: Record<string, number>;
  conflictIds: Set<string>;
  highlightIds: Set<string>;
  onMove: (studentId: string, classNo: number) => void;
  onToggleLock: (studentId: string) => void;
}

const behaviorDot = ['', 'bg-amber-300', 'bg-orange-400', 'bg-red-500'];

// 반 카드 — 드래그(PC) + 「이동」 버튼(터치·키보드) 모두 지원
const ClassCard: React.FC<Props> = ({ stat, students, numClasses, labelStyle, academicText, locks, conflictIds, highlightIds, onMove, onToggleLock }) => {
  const [over, setOver] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const label = classLabel(stat.classNo, labelStyle);

  return (
    <div
      className={`${card} flex flex-col transition-shadow ${over ? 'ring-2 ring-emerald-500 shadow-lg' : ''}`}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData('text/plain');
        if (id) onMove(id, stat.classNo);
      }}
    >
      <div className="px-4 py-3 border-b border-[#EDE8E1] dark:border-[#2E2822]">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className={`text-base font-bold ${strong}`}>{label}</h4>
          <span className={`text-sm font-bold ${strong}`}>{stat.count}명</span>
        </div>
        <div className={`mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] ${muted}`}>
          <span><b className="text-sky-600 dark:text-sky-300">남 {stat.male}</b> · <b className="text-rose-600 dark:text-rose-300">여 {stat.female}</b></span>
          <span>학업 {academicText}</span>
          <span>생활지도 {stat.behaviorSum}점({stat.behaviorHigh}명)</span>
          {stat.basic > 0 && <span>기초 {stat.basic}</span>}
          {stat.special > 0 && <span>특수 {stat.special}</span>}
        </div>
      </div>
      <ul className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1 content-start">
        {students.map(s => {
          const locked = locks[s.id] !== undefined;
          const conflict = conflictIds.has(s.id);
          return (
            <li key={s.id} className="relative">
              <div
                draggable
                onDragStart={e => { e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move'; }}
                title={[
                  `${s.name} (${s.prevClass}반 ${s.prevNumber}번, ${s.gender || '성별 미상'})`,
                  s.rank !== null ? `반 내 석차 ${s.rank}` : '', s.average !== null ? `평균 ${s.average}` : '',
                  `생활지도 ${s.behavior}`, s.basicAcademic ? '기초학력 지원' : '', s.specialNeeds ? '특수교육대상' : '',
                  s.separationRaw ? `분리요청: ${s.separationRaw}` : '', s.togetherRaw ? `같은반희망: ${s.togetherRaw}` : '',
                  s.twinsRaw ? `쌍생아: ${s.twinsRaw}` : '', s.notes ? `특이사항: ${s.notes}` : '',
                ].filter(Boolean).join('\n')}
                className={`group flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md border text-xs cursor-grab active:cursor-grabbing select-none ${
                  conflict ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                    : highlightIds.has(s.id) ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
                      : 'border-[#F0EBE6] dark:border-[#2E2822] bg-[#FAF9F7] dark:bg-[#1A1613]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.gender === '남' ? 'bg-sky-500' : s.gender === '여' ? 'bg-rose-500' : 'bg-gray-400'}`} />
                <span className={`font-medium truncate min-w-[2.5em] ${strong}`}>{s.name}</span>
                <span className={`text-[10px] whitespace-nowrap ${muted}`}>{s.prevClass}-{s.prevNumber}</span>
                {s.behavior > 0 && <span className={`w-1.5 h-1.5 rounded-full ${behaviorDot[s.behavior]}`} aria-label={`생활지도 ${s.behavior}`} />}
                {s.basicAcademic && <span className="shrink-0 text-[9px] leading-4 px-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" title="기초학력 지원">기</span>}
                {s.specialNeeds && <span className="shrink-0 text-[9px] leading-4 px-0.5 rounded bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" title="특수교육대상">특</span>}
                {conflict && <Ban className="w-3 h-3 text-red-500 shrink-0" aria-label="필수 조건 위반" />}
                <span className="ml-auto flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleLock(s.id)}
                    className={`p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 ${locked ? 'text-emerald-600 dark:text-emerald-300' : 'text-[#C4B8B0] opacity-60 group-hover:opacity-100'}`}
                    aria-label={locked ? `${s.name} 고정 해제` : `${s.name} 이 반에 고정`}
                    title={locked ? '고정 해제' : '이 반에 고정(다시 다듬기에서도 유지)'}
                  >
                    {locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuFor(menuFor === s.id ? null : s.id)}
                    className={`px-1 rounded text-[10px] font-bold whitespace-nowrap ${muted} hover:bg-black/5 dark:hover:bg-white/10`}
                    aria-expanded={menuFor === s.id}
                    aria-label={`${s.name} 다른 반으로 이동`}
                  >
                    이동
                  </button>
                </span>
              </div>
              {menuFor === s.id && (
                <div className={`absolute z-20 right-0 mt-1 p-1.5 ${card} shadow-xl flex flex-wrap gap-1 w-48`}>
                  {Array.from({ length: numClasses }, (_, i) => i + 1).filter(c => c !== stat.classNo).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { onMove(s.id, c); setMenuFor(null); }}
                      className="px-2 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200"
                    >
                      {classLabel(c, labelStyle)}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ClassCard;
