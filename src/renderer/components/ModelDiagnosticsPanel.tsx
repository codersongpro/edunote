import React from 'react';
import type { ModelDiagnostics } from '../../preload/types';

interface Props {
  info: ModelDiagnostics;
}

export function ModelDiagnosticsPanel({ info }: Props) {
  const checkedAt = Number.isNaN(Date.parse(info.checkedAt))
    ? info.checkedAt
    : new Date(info.checkedAt).toLocaleString('ko-KR');

  return (
    <div className="mt-2 rounded-md border border-[#E7E5E4] bg-[#FAF9F7] p-2.5 text-xs text-[#44403C] dark:border-[#2E2822] dark:bg-[#171210] dark:text-[#C4B8B0]">
      <p><strong>검증 후보</strong>: {info.chain.join(' → ') || '없음'}</p>
      <p className="mt-1"><strong>현재 선택</strong>: {info.selectedModel || '없음'}</p>
      <p className="mt-1"><strong>최근 실제 생성</strong>: {info.actualModel || '아직 생성 기록 없음'}</p>
      <p className="mt-1"><strong>확인 상태</strong>: {info.verificationStatus === 'verified' ? '공식 정책·키 목록 확인됨' : '최신 여부 미확인'}</p>
      <p className="mt-1"><strong>확인 시각</strong>: {checkedAt}</p>
      <p className="mt-1"><strong>정책 기준</strong>: {info.policySource} (갱신 {info.policyUpdatedAt})</p>
      <p className="mt-1"><strong>선택 이유</strong>: {info.selectionReason}</p>
      {info.listFailed && (
        <p className="mt-1 text-amber-700 dark:text-amber-300">이번 목록 확인에 실패했습니다. 표시된 후보는 24시간 안에 같은 키와 요금제로 확인한 기록이며 최신 여부는 확인되지 않았습니다.</p>
      )}
      {info.blocked.length > 0 && (
        <p className="mt-1 text-amber-700 dark:text-amber-300">일시 제외됨(한도 초과·접근 불가): {info.blocked.join(', ')}</p>
      )}
      {info.available.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer">이 키의 생성 가능 모델 목록 {info.available.length}개</summary>
          <p className="mt-1 break-all leading-relaxed">{info.available.join(', ')}</p>
        </details>
      )}
    </div>
  );
}
