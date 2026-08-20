import React from 'react';
import { findRosterMatch, RosterEntry } from '../lib/studentRoster';

interface Props {
  roster: RosterEntry[];
  identifier: string;
}

// 설정에 등록한 학생 번호-이름 명렬표에서 실명이 매칭되면 화면에만(로컬) 힌트로 보여준다.
// AI 요청에는 전혀 포함되지 않으며, 이 컴포넌트는 순수 표시용이다.
export const RosterNameHint: React.FC<Props> = ({ roster, identifier }) => {
  const match = findRosterMatch(roster, identifier);
  if (!match) return null;
  return (
    <span
      className="ml-1 text-[10px] font-normal text-amber-600 dark:text-amber-400"
      title="명렬표 매칭 — 이 화면에만 표시되며 AI로 전송되지 않습니다"
    >
      (→ {match.name} · 로컬)
    </span>
  );
};
