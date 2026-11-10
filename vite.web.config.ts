// EduNote 웹판 빌드 설정 — 데스크톱과 같은 렌더러(src/renderer)를 src/web 진입점으로 빌드한다.
// 결과물(dist-web)은 Vercel이 정적 사이트로 배포하고, api/ 폴더는 Vercel 서버 함수가 된다.
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as { version: string };

// vercel.json과 같은 sandbox.html 보안 헤더를 개발·미리보기 서버에서도 붙인다(배포 환경과 동일하게 확인).
export const SANDBOX_CSP =
  "sandbox allow-scripts allow-forms allow-modals allow-popups allow-downloads; default-src * data: blob: 'unsafe-inline' 'unsafe-eval'";
function sandboxHeaders(): Plugin {
  const apply = (server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) => {
    server.middlewares.use((req, res, next) => {
      if (typeof req.url === 'string' && req.url.split('?')[0].endsWith('/sandbox.html')) {
        res.setHeader('Content-Security-Policy', SANDBOX_CSP);
      }
      next();
    });
  };
  return { name: 'edunote-sandbox-headers', configureServer: apply, configurePreviewServer: apply };
}

export default defineConfig({
  root: resolve(__dirname, 'src/web'),
  publicDir: resolve(__dirname, 'src/web/public'),
  base: '/',
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), sandboxHeaders()],
  css: {
    postcss: resolve(__dirname, 'postcss.config.js'),
  },
  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
  },
  server: { port: 5180 },
  preview: { port: 4180 },
});
