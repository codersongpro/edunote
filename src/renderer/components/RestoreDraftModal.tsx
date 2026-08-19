import React from 'react';
import { RotateCcw } from 'lucide-react';

interface Props {
  savedAt: string;
  onRestore: () => void;
  onDiscard: () => void;
}

function formatSavedAt(savedAt: string): string {
  const time = Date.parse(savedAt);
  if (Number.isNaN(time)) return '';
  return new Date(time).toLocaleString('ko-KR');
}

// 앱을 켰을 때 이전에 작성하던 생기부 작업이 남아 있으면 복원할지 물어본다.
// 자동으로 되살리지 않는 이유: 지난 학기 작업이 의도치 않게 되살아나면 오히려 혼란스럽고,
// 새 학생 명단으로 시작하려던 사용자의 화면을 덮어쓰게 된다.
const RestoreDraftModal: React.FC<Props> = ({ savedAt, onRestore, onDiscard }) => {
  const when = formatSavedAt(savedAt);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#221E1B] rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="bg-indigo-100 dark:bg-indigo-900/40 p-1.5 rounded-lg">
            <RotateCcw className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
          </div>
          <h2 className="text-base font-bold text-[#1C1917] dark:text-[#F0EBE6]">이어서 작성하시겠어요?</h2>
        </div>
        <p className="text-sm text-[#78716C] dark:text-[#9C8F87] leading-relaxed">
          이전에 작성하던 학생기록 작업이 남아 있습니다. 불러오면 그때의 학생 명단·관찰 내용·생성 결과가 그대로 복원됩니다.
        </p>
        {when && (
          <p className="text-xs text-[#A8A29E] dark:text-[#6B5E57] mt-2">마지막 저장: {when}</p>
        )}
        <div className="grid grid-cols-2 gap-2 mt-5">
          <button
            onClick={onRestore}
            className="py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold"
          >
            이어서 하기
          </button>
          <button
            onClick={onDiscard}
            className="py-2.5 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] text-[#44403C] dark:text-[#C4B8B0] text-sm font-bold hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]"
          >
            새로 시작
          </button>
        </div>
        <p className="text-xs text-[#A8A29E] dark:text-[#6B5E57] mt-3 leading-relaxed">
          "새로 시작"을 고르면 저장된 작업은 지워집니다.
        </p>
      </div>
    </div>
  );
};

export default RestoreDraftModal;
