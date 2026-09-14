import React, { useEffect, useState } from 'react';

export const REVIEW_CHECKLIST_UPDATED_EVENT = 'edunote:review-checklist-updated';

/** 검토 항목이 달라지는 영역. 학생기록과 교무행정은 확인해야 할 내용이 서로 다르다. */
export type ReviewChecklistKind = 'student' | 'document' | 'lesson';

/** 어느 영역에서든 똑같이 확인해야 하는 항목. */
const COMMON_ITEM = '개인정보·보안: 이름·연락처 등 불필요한 개인정보나 대외 공개가 곤란한 내용이 없는지 확인';

const KIND_ITEMS: Record<ReviewChecklistKind, readonly string[]> = {
  student: [
    '관찰 근거·과장: 실제 관찰과 다른 내용이나 과장 표현이 없는지 확인',
    '기재 요령: 최신 학교생활기록부 기재요령에서 금지한 내용이 들어가지 않았는지 확인',
    '분량·문체: 입력 글자 수 제한을 넘지 않고 학생기록에 맞는 문체인지 확인',
  ],
  document: [
    '사실 확인: 일시·장소·대상·금액 등 수치와 일정이 입력 자료와 일치하는지 확인',
    '근거·붙임: 관련 문서와 붙임 표기가 실제 근거·첨부와 맞는지 확인',
    '형식·문체: 항목 기호와 공문서 문체가 기관 서식에 맞는지 확인',
  ],
  lesson: [
    '교육과정: 학년 수준과 성취기준에 맞고 사실 오류가 없는지 확인',
    '활동 적합성: 수업 시간, 준비물, 안전 측면에서 실제로 운영 가능한지 확인',
    '저작권: 외부 자료를 쓴 경우 출처와 수업 활용 범위를 확인',
  ],
};

export const reviewChecklistItems = (kind: ReviewChecklistKind): string[] =>
  [COMMON_ITEM, ...KIND_ITEMS[kind]];

interface ReviewChecklistProps {
  content: string;
  resetKey: string;
  /** 생략하면 교무행정 문서 기준으로 표시한다. */
  kind?: ReviewChecklistKind;
}

export const ReviewChecklist: React.FC<ReviewChecklistProps> = ({ content, resetKey, kind = 'document' }) => {
  const items = reviewChecklistItems(kind);
  const [enabled, setEnabled] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));

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
    setChecked(items.map(() => false));
  }, [resetKey, kind]);

  if (!enabled || !content.trim()) return null;

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30 no-print">
      <p className="mb-2 text-xs font-bold text-amber-800 dark:text-amber-200">사용 전 체크리스트</p>
      <div className="space-y-1.5">
        {items.map((item, index) => (
          <label key={item} className="flex cursor-pointer items-start gap-2 text-xs text-[#44403C] dark:text-[#C4B8B0]">
            <input
              type="checkbox"
              checked={checked[index] ?? false}
              onChange={event => setChecked(previous => previous.map((value, itemIndex) => (
                itemIndex === index ? event.target.checked : value
              )))}
              className="mt-0.5"
            />
            <span>{item}</span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">이 항목은 자동검토 방식이 아니라, 교사가 직접 확인하기 위한 체크리스트 입니다.</p>
    </div>
  );
};
