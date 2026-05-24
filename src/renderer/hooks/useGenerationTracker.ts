import { useContext, useRef, useEffect } from 'react';
import { GlobalStateContext } from '../GlobalStateContext';
import { AppMode } from '../types';

export function useGenerationTracker(mode: AppMode) {
  const { setGeneratingMode, isCancelled, clearCancel } = useContext(GlobalStateContext);
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

  return { startGeneration, updateProgress, endGeneration, isCancelRequested };
}
