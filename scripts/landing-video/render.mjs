// 랜딩페이지 영상 렌더러
// 사용법:
//   node scripts/landing-video/render.mjs            # 전체(소개 영상 + 첫 화면 모션그래픽 가로/세로)
//   node scripts/landing-video/render.mjs motion     # 모션그래픽만
//   node scripts/landing-video/render.mjs intro      # 소개 영상만
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

const JOBS = {
  intro: [
    { page: 'intro.html', vw: 1920, vh: 1080, out: 'edunote-intro', scale: '1280:720', crf: 24, poster: 7.5 },
  ],
  motion: [
    { page: 'motion.html', vw: 1920, vh: 1080, out: 'edunote-motion', scale: '1600:900', crf: 27, poster: 29.5 },
    { page: 'motion.html', vw: 1080, vh: 1920, out: 'edunote-motion-portrait', scale: '720:1280', crf: 27, poster: 29.5 },
  ],
};
const which = process.argv[2];
const jobs = which ? JOBS[which] : [...JOBS.intro, ...JOBS.motion];
if (!jobs) throw new Error('알 수 없는 대상: ' + which);

const browser = await chromium.launch();
for (const job of jobs) {
  const page = await browser.newPage({ viewport: { width: job.vw, height: job.vh } });
  await page.goto(pathToFileURL(path.join(here, job.page)).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const duration = await page.evaluate(() => window.DURATION);

  const ffmpeg = spawn('ffmpeg', [
    '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', `scale=${job.scale}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(job.crf),
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
    path.join(outDir, job.out + '.mp4'),
  ], { stdio: ['pipe', 'ignore', 'inherit'] });

  const total = Math.round(duration * FPS);
  for (let i = 0; i < total; i++) {
    await page.evaluate((t) => window.seek(t), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ffmpeg.stdin.write(buf)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
    if (i % 300 === 0) console.log(`${job.out}: frame ${i}/${total}`);
  }
  ffmpeg.stdin.end();
  await new Promise((r) => ffmpeg.on('close', r));

  await page.evaluate((t) => window.seek(t), job.poster);
  await page.screenshot({ path: path.join(outDir, job.out + '-poster.jpg'), type: 'jpeg', quality: 80 });
  await page.close();
}
await browser.close();
console.log('done');
