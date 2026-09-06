import React, { useEffect, useState } from 'react';

export const REVIEW_CHECKLIST_UPDATED_EVENT = 'edunote:review-checklist-updated';

export const REVIEW_CHECKLIST_ITEMS = [
  '개인정보: 이름·연락처 등 불필요한 개인정보가 없는지 확인',
  '관찰 근거·과장: 실제 관찰과 다른 내용이나 과장 표현이 없는지 확인',
  '적용 지침: 최신 기재요령·학교 지침에 맞는지 확인',
] as const;

interface ReviewChecklistProps {
  content: string;
  resetKey: string;
}

export const ReviewChecklist: React.FC<ReviewChecklistProps> = ({ content, resetKey }) => {
  const [enabled, setEnabled] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(() => REVIEW_CHECKLIST_ITEMS.map(() => false));

  useEffect(() => {
    let cancelled = false;
    window.electronAPI.getConfig('reviewChecklistEnabled')
      .then(value => { if (!cancelled) setEnabled(value === true); })
      .catch(() => { if (!cancelled) setEnabled(false); });
    const handleUpdate = (event: Event) => setEnabled((event as CustomEvent<boolean>).detail === true);
    window.addEventListener(REVIEW_CHECKLIST_UPDATED_EVENT, handleUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(REVIEW_CHECKLIST_UPDATED_EVENT, handleUpdate);
    };
  }, []);

  useEffect(() => {
    setChecked(REVIEW_CHECKLIST_ITEMS.map(() => false));
  }, [resetKey]);

  if (!enabled || !content.trim()) return null;

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30 no-print">
      <p className="mb-2 text-xs font-bold text-amber-800 dark:text-amber-200">결과 사용 전 교사 검토</p>
      <div className="space-y-1.5">
        {REVIEW_CHECKLIST_ITEMS.map((item, index) => (
          <label key={item} className="flex cursor-pointer items-start gap-2 text-xs text-[#44403C] dark:text-[#C4B8B0]">
            <input
              type="checkbox"
              checked={checked[index]}
              onChange={event => setChecked(previous => previous.map((value, itemIndex) => (
                itemIndex === index ? event.target.checked : value
              )))}
              className="mt-0.5"
            />
            <span>{item}</span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">이 항목은 자동 인증이 아니라, 교사가 직접 확인하기 위한 메모입니다.</p>
    </div>
  );
};
