import { useContext, useRef, useEffect } from 'react';
import { GlobalStateContext } from '../GlobalStateContext';
import { AppMode } from '../types';

export function useGenerationTracker(mode: AppMode) {
  const { setGeneratingMode, isCancelled, clearCancel, getCancelSignal } = useContext(GlobalStateContext);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subKeyRef = useRef<string | undefined>(undefined);

  // 일괄 생성 루프 내에서 호출하여 중단 여부 확인
  const isCancelRequested = (): boolean => isCancelled(mode);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Overloaded: startGeneration(subKey?: string) → auto-timer
  //             startGeneration(progress: number)  → manual (OpinionGenerator)
  const startGeneration = (arg?: string | number) => {
    clearTimer();
    // 새 일괄 생성을 시작할 때 이전 중단 요청 플래그를 초기화
    clearCancel(mode);

    if (typeof arg === 'number') {
      subKeyRef.current = undefined;
      setGeneratingMode(mode, arg);
      return;
    }

    subKeyRef.current = arg;
    let progress = 5;
    setGeneratingMode(mode, progress);
    if (arg) setGeneratingMode(arg, progress);

    intervalRef.current = setInterval(() => {
      progress = Math.min(progress + (90 - progress) * 0.06 + 0.4, 90);
      const p = Math.round(progress);
      setGeneratingMode(mode, p);
      if (subKeyRef.current) setGeneratingMode(subKeyRef.current, p);
    }, 600);
  };

  const updateProgress = (progress: number) => {
    clearTimer();
    setGeneratingMode(mode, progress);
    if (subKeyRef.current) setGeneratingMode(subKeyRef.current, progress);
  };

  const endGeneration = () => {
    clearTimer();
    setGeneratingMode(mode, null);
    if (subKeyRef.current) {
      setGeneratingMode(subKeyRef.current, null);
      subKeyRef.current = undefined;
    }
    // 종료 시 cancel 플래그도 정리
    clearCancel(mode);
  };

  // AI 호출을 취소 신호와 함께 실행 — 중단 버튼 클릭 시 즉시 reject
  const callWithAbort = <T>(fn: () => Promise<T>): Promise<T> => {
    const signal = getCancelSignal(mode);
    if (signal.aborted || isCancelled(mode)) return Promise.reject(new Error('CANCELLED'));
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(new Error('CANCELLED'));
      signal.addEventListener('abort', onAbort, { once: true });
      fn().then(value => {
        // 중단 직후 새 신호를 받은 호출이 결과를 화면에 반영하지 않도록 한 번 더 확인한다.
        if (isCancelled(mode)) reject(new Error('CANCELLED'));
        else resolve(value);
      }).catch(reject).finally(() => {
        signal.removeEventListener('abort', onAbort);
      });
    });
  };

  return { startGeneration, updateProgress, endGeneration, isCancelRequested, callWithAbort };
}
