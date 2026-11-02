import React from 'react';
import { classLabel } from '../../lib/classAssignment/criteria';
import type { ClassStat } from '../../lib/classAssignment/metrics';
import type { ClassLabelStyle } from '../../lib/classAssignment/types';
import { muted, strong } from './ui';

// 전학년 반 → 배정반 이동표 (색이 진할수록 많이 이동)
const TransitionMatrix: React.FC<{ stats: ClassStat[]; prevClasses: number[]; labelStyle: ClassLabelStyle; isoThr: Map<number, number> }> = ({ stats, prevClasses, labelStyle, isoThr }) => {
  const max = Math.max(1, ...stats.flatMap(s => Object.values(s.prevCounts)));
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse min-w-full">
        <thead>
          <tr>
            <th className={`sticky left-0 bg-white dark:bg-[#221E1B] px-2 py-1.5 text-left font-medium ${muted}`}>전학년 ＼ 배정</th>
            {stats.map(s => <th key={s.classNo} className={`px-2 py-1.5 font-bold ${strong}`}>{classLabel(s.classNo, labelStyle)}</th>)}
            <th className={`px-2 py-1.5 font-medium ${muted}`}>계</th>
          </tr>
        </thead>
        <tbody>
          {prevClasses.map(p => {
            const thr = isoThr.get(p) ?? 0;
            let sum = 0;
            return (
              <tr key={p} className="border-t border-[#F0EBE6] dark:border-[#2E2822]">
                <td className={`sticky left-0 bg-white dark:bg-[#221E1B] px-2 py-1.5 font-medium ${strong}`}>{p}반</td>
                {stats.map(s => {
                  const n = s.prevCounts[p] ?? 0;
                  sum += n;
                  const lonely = thr > 0 && n > 0 && n < thr;
                  return (
                    <td key={s.classNo} className="px-1 py-1 text-center">
                      <span
                        className={`inline-block min-w-[2rem] rounded px-1.5 py-0.5 font-bold ${lonely ? 'ring-2 ring-red-400' : ''} ${n === 0 ? 'text-[#C4B8B0]' : 'text-emerald-900 dark:text-emerald-100'}`}
                        style={n ? { backgroundColor: `rgba(16,185,129,${0.12 + (n / max) * 0.5})` } : undefined}
                        title={lonely ? `몫(${thr}명) 미만` : undefined}
                      >
                        {n}
                      </span>
                    </td>
                  );
                })}
                <td className={`px-2 py-1.5 text-center ${muted}`}>{sum}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TransitionMatrix;
