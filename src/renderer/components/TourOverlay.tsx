import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Tour } from '../lib/tours';

// iorad "Try it" 모드와 같은 실시간 오버레이.
// 현재 단계의 대상 요소를 찾아 하이라이트(주변을 어둡게 + 펄스 링)하고,
// 옆에 말풍선(제목·설명·진행·이전/다음/건너뛰기)을 띄운다.

type Rect = { top: number; left: number; width: number; height: number };

interface TourOverlayProps {
  tour: Tour;
  stepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

const TOOLTIP_WIDTH = 320;
const GAP = 12;

export const TourOverlay: React.FC<TourOverlayProps> = ({ tour, stepIndex, onNext, onPrev, onClose }) => {
  const step = tour.steps[stepIndex];
  const [rect, setRect] = useState<Rect | null>(null);

  const measure = useCallback(() => {
    const el = step ? document.querySelector(step.selector) : null;
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  // 단계가 바뀌면 대상으로 스크롤한 뒤 위치를 측정한다(스크롤 애니메이션 후 한 번 더).
  useLayoutEffect(() => {
    const el = step ? document.querySelector(step.selector) : null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    measure();
    const t = setTimeout(measure, 320);
    return () => clearTimeout(t);
  }, [step, measure]);

  // 창 크기 변경·스크롤 시 하이라이트 위치를 따라가게 한다.
  useEffect(() => {
    const onChange = () => measure();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [measure]);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!step) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === tour.steps.length - 1;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 말풍선 위치 계산 (대상이 없으면 화면 중앙에 안내만 표시)
  let tipTop: number;
  let tipLeft: number;
  if (rect) {
    const placement = step.placement || 'bottom';
    if (placement === 'top') {
      tipTop = rect.top - GAP - 150;
      tipLeft = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    } else if (placement === 'left') {
      tipTop = rect.top;
      tipLeft = rect.left - TOOLTIP_WIDTH - GAP;
    } else if (placement === 'right') {
      tipTop = rect.top;
      tipLeft = rect.left + rect.width + GAP;
    } else {
      tipTop = rect.top + rect.height + GAP;
      tipLeft = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    }
  } else {
    tipTop = vh / 2 - 90;
    tipLeft = vw / 2 - TOOLTIP_WIDTH / 2;
  }
  // 화면 밖으로 나가지 않게 보정
  tipLeft = Math.max(GAP, Math.min(tipLeft, vw - TOOLTIP_WIDTH - GAP));
  tipTop = Math.max(GAP, Math.min(tipTop, vh - 170));

  return (
    // 컨테이너는 클릭을 통과시켜(app은 그대로 사용 가능) 말풍선만 상호작용하게 한다.
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: 'none' }}>
      {rect ? (
        <div
          className="absolute rounded-md"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
            border: '2px solid #3B82F6',
            transition: 'top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease',
          }}
        >
          {/* iorad식 펄스 링 강조 */}
          <div className="absolute -inset-0.5 rounded-md ring-2 ring-blue-400 animate-pulse" />
        </div>
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} />
      )}

      <div
        className="absolute rounded-xl border border-[#E7E5E4] bg-white p-4 shadow-2xl dark:border-[#2E2822] dark:bg-[#221E1B]"
        style={{ top: tipTop, left: tipLeft, width: TOOLTIP_WIDTH, pointerEvents: 'auto' }}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-300">{tour.title}</span>
          <button
            onClick={onClose}
            className="rounded p-0.5 text-[#78716C] hover:bg-[#FAF9F7] dark:text-[#9C8F87] dark:hover:bg-[#2E2822]"
            title="튜토리얼 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#F0EBE6]">{step.title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-[#57534E] dark:text-[#C4B8B0]">{step.body}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#78716C] dark:text-[#9C8F87]">
            {stepIndex + 1} / {tour.steps.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="rounded-md px-2 py-1 text-xs font-semibold text-[#78716C] hover:bg-[#FAF9F7] dark:text-[#9C8F87] dark:hover:bg-[#2E2822]"
            >
              건너뛰기
            </button>
            {!isFirst && (
              <button
                onClick={onPrev}
                className="rounded-md border border-[#E7E5E4] px-2.5 py-1 text-xs font-bold text-[#44403C] hover:bg-[#FAF9F7] dark:border-[#2E2822] dark:text-[#C4B8B0] dark:hover:bg-[#2E2822]"
              >
                이전
              </button>
            )}
            <button
              onClick={onNext}
              className="rounded-md bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700"
            >
              {isLast ? '완료' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
