// 랜딩페이지 소개 영상 렌더러
// 사용법: node scripts/landing-video/render.mjs
// 필요: playwright(Chromium), ffmpeg, 시스템에 설치된 Pretendard 폰트
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../docs/assets/video');
const FPS = 30;
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(path.join(here, 'intro.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
const duration = await page.evaluate(() => window.DURATION);

const ffmpeg = spawn('ffmpeg', [
  '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
  path.join(outDir, 'edunote-intro.mp4'),
], { stdio: ['pipe', 'inherit', 'inherit'] });

const total = Math.round(duration * FPS);
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.seek(t), i / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
  if (!ffmpeg.stdin.write(buf)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
  if (i % 150 === 0) console.log(`frame ${i}/${total}`);
}
ffmpeg.stdin.end();
await new Promise((r) => ffmpeg.on('close', r));

// 포스터: 브랜드 장면(약 7초)
await page.evaluate(() => window.seek(7.5));
await page.screenshot({ path: path.join(outDir, 'edunote-intro-poster.jpg'), type: 'jpeg', quality: 85 });
await browser.close();
console.log('done');
