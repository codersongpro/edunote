// 랜딩페이지 영상 렌더러
// 사용법:
//   node scripts/landing-video/render.mjs            # 전체(소개 영상 + 첫 화면 모션그래픽 가로/세로)
//   node scripts/landing-video/render.mjs motion     # 모션그래픽만
//   node scripts/landing-video/render.mjs intro      # 소개 영상만
// 필요: playwright(Chromium), ffmpeg, python3 + numpy(사운드 합성), 시스템에 설치된 Pretendard 폰트
import { spawn, execFileSync } from 'node:child_process';
import os from 'node:os';
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
    { page: 'motion.html', vw: 1920, vh: 1080, out: 'edunote-motion', scale: '1600:900', crf: 27, poster: 37.5, sound: true },
    { page: 'motion.html', vw: 1080, vh: 1920, out: 'edunote-motion-portrait', scale: '720:1280', crf: 27, poster: 37.5, sound: true },
  ],
};
const which = process.argv[2];
const jobs = which ? JOBS[which] : [...JOBS.intro, ...JOBS.motion];
if (!jobs) throw new Error('알 수 없는 대상: ' + which);

// 모션그래픽 사운드트랙은 sound.py로 합성한다.
let soundWav = null;
if (jobs.some((j) => j.sound)) {
  soundWav = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'edunote-sound-')), 'motion-sound.wav');
  execFileSync('python3', [path.join(here, 'sound.py'), soundWav], { stdio: 'inherit' });
}

const browser = await chromium.launch();
for (const job of jobs) {
  const page = await browser.newPage({ viewport: { width: job.vw, height: job.vh } });
  await page.goto(pathToFileURL(path.join(here, job.page)).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const duration = await page.evaluate(() => window.DURATION);

  const audio = job.sound
    ? ['-i', soundWav, '-map', '0:v', '-map', '1:a', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '128k', '-shortest']
    : ['-an'];
  const ffmpeg = spawn('ffmpeg', [
    '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', ...audio,
    '-vf', `scale=${job.scale}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(job.crf),
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
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
