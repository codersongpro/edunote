import { useContext } from 'react';
import { GlobalStateContext } from '../GlobalStateContext';
import { AppMode } from '../types';

export function useGenerationTracker(mode: AppMode) {
  const { setGeneratingMode } = useContext(GlobalStateContext);
  return {
    startGeneration: (progress: number = -1) => setGeneratingMode(mode, progress),
    updateProgress: (progress: number) => setGeneratingMode(mode, progress),
    endGeneration: () => setGeneratingMode(mode, null),
  };
}
