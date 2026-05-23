import { useContext, useRef, useEffect } from 'react';
import { GlobalStateContext } from '../GlobalStateContext';
import { AppMode } from '../types';

export function useGenerationTracker(mode: AppMode) {
  const { setGeneratingMode } = useContext(GlobalStateContext);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subKeyRef = useRef<string | undefined>(undefined);

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
  };

  return { startGeneration, updateProgress, endGeneration };
}
