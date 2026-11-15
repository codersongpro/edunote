/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      // compact: 휴대폰·태블릿 세로(1000px 미만) 전용 규칙. PC 앱(exe)은 창 최소 폭이 1000px이라 적용되지 않는다.
      // src/renderer/lib/useIsMobile.ts의 MOBILE_QUERY, index.css의 @media와 같은 값이어야 한다.
      screens: {
        compact: { raw: '(max-width: 999px)' },
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
