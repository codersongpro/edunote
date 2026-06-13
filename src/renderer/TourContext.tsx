import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { TOURS } from './lib/tours';
import { TourOverlay } from './components/TourOverlay';

// 인터랙티브 튜토리얼(투어)의 진행 상태를 관리하고, 활성화되면 오버레이를 띄운다.
// 화면(컴포넌트)에서는 useTour().startTour(id)만 호출하면 된다.

type TourContextValue = {
  startTour: (tourId: string) => void;
  hasTour: (tourId: string) => boolean;
  isCompleted: (tourId: string) => boolean;
};

const TourContext = createContext<TourContextValue | null>(null);

const DONE_KEY = 'edunote_tour_done';

function readDone(): Set<string> {
  try {
    const raw = localStorage.getItem(DONE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState<Set<string>>(() => readDone());

  const activeTour = activeTourId ? TOURS[activeTourId] : null;

  const markDone = useCallback((tourId: string) => {
    setDone(prev => {
      const next = new Set(prev);
      next.add(tourId);
      try {
        localStorage.setItem(DONE_KEY, JSON.stringify([...next]));
      } catch {
        // 저장 실패는 무시 (튜토리얼 완료 표시는 부가 정보일 뿐)
      }
      return next;
    });
  }, []);

  const startTour = useCallback((tourId: string) => {
    if (!TOURS[tourId]) return;
    setActiveTourId(tourId);
    setStepIndex(0);
  }, []);

  const endTour = useCallback(
    (completed: boolean) => {
      if (completed && activeTourId) markDone(activeTourId);
      setActiveTourId(null);
      setStepIndex(0);
    },
    [activeTourId, markDone],
  );

  const next = useCallback(() => {
    if (!activeTour) return;
    if (stepIndex >= activeTour.steps.length - 1) endTour(true);
    else setStepIndex(i => i + 1);
  }, [activeTour, stepIndex, endTour]);

  const prev = useCallback(() => {
    setStepIndex(i => Math.max(0, i - 1));
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({
      startTour,
      hasTour: (id: string) => !!TOURS[id],
      isCompleted: (id: string) => done.has(id),
    }),
    [startTour, done],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {activeTour && (
        <TourOverlay
          tour={activeTour}
          stepIndex={stepIndex}
          onNext={next}
          onPrev={prev}
          onClose={() => endTour(false)}
        />
      )}
    </TourContext.Provider>
  );
};

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}
