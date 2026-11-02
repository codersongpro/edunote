// 반편성 화면 공통 스타일 (에듀노트 톤: 교무행정 = emerald)
export const card = 'bg-white dark:bg-[#221E1B] rounded-xl border border-[#EDE8E1] dark:border-[#2E2822]';
export const muted = 'text-[#78716C] dark:text-[#9C8F87]';
export const strong = 'text-[#1C1917] dark:text-[#F0EBE6]';
export const input = 'px-3 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#171210] text-sm text-[#1C1917] dark:text-[#F0EBE6] outline-none focus:ring-2 focus:ring-emerald-500/40';
export const btnPrimary = 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold shadow-sm transition-colors';
export const btnSecondary = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#171210] hover:bg-[#F5F5F4] dark:hover:bg-[#2A2420] disabled:opacity-50 text-sm font-medium text-[#44403C] dark:text-[#C4B8B0] transition-colors';
export const btnDanger = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors';

export const statusStyle = {
  pass: { text: '충족', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800' },
  warn: { text: '양호', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800' },
  fail: { text: '조정 필요', cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800' },
} as const;
