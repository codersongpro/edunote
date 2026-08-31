import React from 'react';
import { Check, Lock } from 'lucide-react';
import {
  FEATURES_WITHOUT_KEY,
  FEATURES_NEEDING_KEY,
  API_KEY_SCOPE_SUMMARY,
  type FeatureGroup,
} from '../lib/apiKeyFeatures';

interface Props {
  /** compact는 온보딩처럼 폭이 좁은 곳에서 한 줄 요약과 영역 이름만 보여준다. */
  variant?: 'full' | 'compact';
}

const GroupList: React.FC<{ groups: FeatureGroup[]; compact: boolean }> = ({ groups, compact }) => (
  <ul className="space-y-1.5">
    {groups.map(group => (
      <li key={group.section} className="text-xs leading-relaxed">
        <span className="font-bold">{group.section}</span>
        <span className="mx-1 opacity-50">·</span>
        <span>{group.features.join(', ')}</span>
        {!compact && group.note && (
          <span className="block mt-0.5 opacity-70">{group.note}</span>
        )}
      </li>
    ))}
  </ul>
);

/**
 * Gemini API 키 없이 쓸 수 있는 기능과 키가 있어야 하는 기능을 함께 보여준다.
 * 설정 화면·사용 방법 화면·최초 실행 온보딩이 같은 목록(lib/apiKeyFeatures.ts)을 쓴다.
 */
export const ApiKeyScopeNotice: React.FC<Props> = ({ variant = 'full' }) => {
  const compact = variant === 'compact';

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-[#78716C] dark:text-[#9C8F87]">
        {API_KEY_SCOPE_SUMMARY}
      </p>

      <div className={compact ? 'space-y-3' : 'grid gap-3 md:grid-cols-2'}>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <Check className="h-3.5 w-3.5 shrink-0" />
            키 없이 바로 쓸 수 있는 기능
          </p>
          <div className="text-emerald-700 dark:text-emerald-300">
            <GroupList groups={FEATURES_WITHOUT_KEY} compact={compact} />
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            API 키가 있어야 하는 기능
          </p>
          <div className="text-amber-700 dark:text-amber-400">
            <GroupList groups={FEATURES_NEEDING_KEY} compact={compact} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyScopeNotice;
