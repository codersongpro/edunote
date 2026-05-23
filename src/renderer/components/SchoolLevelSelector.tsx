
import React from 'react';
import { SchoolLevel } from '../types';

interface Props {
  currentLevel: SchoolLevel;
  onLevelChange: (level: SchoolLevel) => void;
}

const SchoolLevelSelector: React.FC<Props> = ({ currentLevel, onLevelChange }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-center sm:space-x-6 space-y-2 sm:space-y-0">
      <span className="text-sm font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full transition-colors">
        학교급을 먼저 선택해주세요
      </span>
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl transition-colors">
        {Object.values(SchoolLevel).map((level) => {
          const isActive = currentLevel === level;
          return (
            <button
              key={level}
              onClick={() => onLevelChange(level)}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                isActive
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md shadow-slate-200/50 dark:shadow-none ring-1 ring-indigo-100 dark:ring-indigo-900/30 scale-100'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700'
              }`}
            >
              {level}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SchoolLevelSelector;
