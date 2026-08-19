import React from 'react';
import { getByteLength, getByteLimitState } from '../lib/textLength';

interface Props {
  text: string;
  /** 이 항목에 적용할 바이트 상한(설정에서 조정 가능). */
  limit: number;
}

// 생기부 결과 입력칸 위에 겹쳐 표시하는 글자수/바이트수 배지.
// 4개 생성기(행발·교과세특·창체·스포츠클럽)가 같은 표시를 쓰므로 한 곳에 모아 둔다.
//
// 상한을 함께 보여주는 이유: 기재요령은 학년도·학교급마다 달라 앱의 기본값이 사용자의
// 실제 기준과 다를 수 있다. 적용 중인 기준을 노출해야 사용자가 경고를 신뢰할지 판단할 수 있다.
export const ByteCountBadge: React.FC<Props> = ({ text, limit }) => {
  const content = text || '';
  const bytes = getByteLength(content);
  const state = getByteLimitState(content, limit);

  const toneClass =
    state === 'over'
      ? 'text-red-600 dark:text-red-400 font-bold'
      : state === 'near'
        ? 'text-amber-600 dark:text-amber-400 font-semibold'
        : 'text-[#A8A29E]';

  return (
    <div className={`absolute bottom-3 right-3 text-xs pointer-events-none ${toneClass}`}>
      {content.length}자/{bytes}바이트
      {state !== 'unknown' && <span className="ml-1 font-normal opacity-80">/ 기준 {limit}</span>}
      {state === 'over' && <span className="ml-1">· 초과</span>}
    </div>
  );
};

export default ByteCountBadge;
