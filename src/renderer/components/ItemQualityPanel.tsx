import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import type { ItemFinding } from '../lib/itemQuality';
import type { ItemVerification } from '../services/geminiService';

// 학생용 문항 점검 결과. 코드 점검은 생성 직후 자동으로 보여 주고,
// AI 독립 풀이 검증은 요청을 한 번 더 쓰므로 교사가 버튼으로 실행한다.

interface Props {
  findings: ItemFinding[];
  verification: { results: ItemVerification[]; model: string; stale: boolean } | null;
  isVerifying: boolean;
  onVerify: () => void;
  // 퀴즈는 출제 정답과 비교하고, 워크시트는 AI 예시 풀이만 보여 준다.
  hasAnswerKey: boolean;
}

const STATUS_LABEL: Record<ItemVerification['status'], { text: string; className: string }> = {
  ok: { text: '문제없음', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  check: { text: '확인 필요', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  mismatch: { text: '정답 불일치', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' },
  unsolvable: { text: '풀 수 없음', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' },
};

export function ItemQualityPanel({ findings, verification, isVerifying, onVerify, hasAnswerKey }: Props) {
  const [open, setOpen] = useState(true);
  const warnings = findings.filter(finding => finding.severity === 'warning').length;
  const problems = verification?.results.filter(result => result.status !== 'ok').length ?? 0;
  const summary = [
    findings.length ? `형식 점검 ${findings.length}건${warnings ? `(주의 ${warnings})` : ''}` : '형식 점검 이상 없음',
    verification ? (problems ? `AI 풀이 확인 필요 ${problems}문항` : 'AI 풀이 이상 없음') : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="rounded-lg border border-sky-200 dark:border-sky-900/60 bg-sky-50/60 dark:bg-sky-950/20 p-2.5 text-xs shrink-0">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(value => !value)} className="flex items-center gap-1 font-bold text-sky-900 dark:text-sky-100" aria-expanded={open}>
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          문항 점검
        </button>
        <span className="text-[11px] text-sky-800 dark:text-sky-200">{summary}</span>
        <button
          type="button"
          onClick={onVerify}
          disabled={isVerifying}
          className="ml-auto flex items-center gap-1 rounded bg-sky-600 px-3 py-1 font-bold text-white disabled:opacity-40"
          title="정답을 빼고 AI에게 다시 풀게 해 정답 오류·답이 둘인 문항·조건이 빠진 문항을 찾습니다. AI 요청을 한 번 더 사용합니다."
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          {isVerifying ? '검증 중...' : verification ? 'AI로 다시 풀어 재검증' : 'AI로 다시 풀어 검증'}
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-2">
          {findings.length > 0 && (
            <ul className="space-y-1">
              {findings.map((finding, index) => (
                <li key={`${finding.category}-${index}`} className="flex gap-2 leading-relaxed">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${finding.severity === 'warning' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
                    {finding.item}·{finding.category}
                  </span>
                  <span className="text-[#44403C] dark:text-[#C4B8B0]">{finding.message}</span>
                </li>
              ))}
            </ul>
          )}

          {verification && (
            <div className="space-y-1">
              {verification.stale && (
                <p className="font-semibold text-red-600">문항이 수정되어 아래 검증 결과는 이전 내용 기준입니다. 다시 검증해 주세요.</p>
              )}
              <div className="m-scroll-x overflow-x-auto">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-sky-100/70 dark:bg-sky-900/30 text-left">
                      <th className="px-2 py-1 font-bold">문항</th>
                      <th className="px-2 py-1 font-bold">결과</th>
                      <th className="px-2 py-1 font-bold">{hasAnswerKey ? 'AI 풀이 / 출제 정답' : 'AI 예시 풀이'}</th>
                      <th className="px-2 py-1 font-bold">확인할 점</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verification.results.map(result => (
                      <tr key={result.item} className="border-t border-sky-100 dark:border-sky-900/40 align-top">
                        <td className="px-2 py-1 whitespace-nowrap">{result.item}</td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          <span className={`rounded px-1.5 py-0.5 font-bold ${STATUS_LABEL[result.status].className}`}>{STATUS_LABEL[result.status].text}</span>
                        </td>
                        <td className="px-2 py-1">
                          {result.aiAnswer || '-'}
                          {hasAnswerKey && result.expected !== undefined && <span className="text-[#78716C]"> / {result.expected}</span>}
                        </td>
                        <td className="px-2 py-1">{result.issues.length ? result.issues.join(', ') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-[#78716C]">
                검증 모델: {verification.model || '알 수 없음'} · AI도 틀릴 수 있으니 "정답 불일치"·"풀 수 없음" 문항은 교사가 직접 확인해 주세요.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
