// 이미지 등 정적 자산 import를 위한 타입 선언 (electron-vite가 URL 문자열로 변환).
declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}
