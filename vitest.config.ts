import { defineConfig } from 'vitest/config';

// 순수 로직(lib) 단위 테스트용 설정.
// sanitizeHtml·markdownOrHtmlToHtml은 DOMParser를 사용하므로 jsdom 환경을 쓴다.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/renderer/lib/__tests__/**/*.test.ts'],
  },
});
