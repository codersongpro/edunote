import { useEffect, useState } from 'react';

// 휴대폰·태블릿 세로 화면 판정 기준(1000px 미만). 화면 코드의 `compact:` 규칙(tailwind.config.js),
// index.css의 @media와 같은 값이다. PC 앱(exe)은 창 최소 폭이 1000px이라 이 값이 참이 되는 일이 없다
// — 모바일 전용 분기에만 쓴다.
export const MOBILE_QUERY = '(max-width: 999px)';

function matches(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(MOBILE_QUERY).matches;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}
