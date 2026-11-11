// 개발자 소개 랜딩페이지 — 앱의 도움말/정보·설정 화면과 랜딩페이지 「만든 사람」 카드가 같은 주소를 쓴다.
export const DEVELOPER_HOMEPAGE_URL = 'https://songpro.app';

// 제작자 표기 — 홈·정보·설정 화면이 같은 문구를 쓰도록 한곳에서 관리한다.
// (랜딩페이지 docs/index.html과 데스크톱 메뉴 src/main/index.ts도 같은 문구를 쓴다.)
export const CREATOR = {
  name: '송동석 (Songpro / Dustin)',
  role: 'AI Product Builder · Educator · Data Analyst',
  slogan: '즐거움은 더하고, 불편함은 덜고.',
} as const;

// 저작권 표기 — 연도는 화면에 그릴 때의 현재 연도를 쓴다.
export const copyrightText = (year: number = new Date().getFullYear()) =>
  `Copyright © ${year} ${CREATOR.name}. All rights reserved.`;

// 라이선스·이용약관·오픈소스 고지 — 웹에 공개된 법적 고지 페이지(docs/legal)로 연결한다.
export const LEGAL_LINKS: { label: string; url: string }[] = [
  { label: '라이선스', url: 'https://ednote.vercel.app/legal/#license' },
  { label: '이용약관', url: 'https://ednote.vercel.app/legal/#eula' },
  { label: '오픈소스 고지', url: 'https://ednote.vercel.app/legal/#notices' },
];
