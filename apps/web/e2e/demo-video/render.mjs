// Demo intro video, step 2 of 2 (README.md in this folder): renders video.html frame by frame (every animation is
// seeked, so the result never drops a frame) and pipes the frames to ffmpeg. Needs ffmpeg on PATH and the shots
// from capture.mjs. Output: e2e/demo-video/out/lightning-shop-day.mp4 and poster.jpg.
//
//   node e2e/demo-video/render.mjs                 the video
//   node e2e/demo-video/render.mjs --stills=3,9.5  only those instants, as PNGs in out/ (to check a layout)
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({ options: { stills: { type: 'string' } } });
const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const OUT = here('./out/');
mkdirSync(OUT, { recursive: true });
const shots = JSON.parse(readFileSync(here('./shots/shots.json'), 'utf8'));
// Inlined, not an <img>: only then can its CSS animations be seeked frame by frame.
const loaderSvg = readFileSync(here('../../public/lightning-loader.svg'), 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(here('./video.html')).href);
await page.evaluate(([s, svg]) => build(s, svg), [shots, loaderSvg]);
const { FPS, DURATION } = await page.evaluate(() => window.VIDEO);

async function frameAt(seconds, options = {}) {
  await page.evaluate((t) => seek(t), seconds);
  return page.screenshot(options);
}

if (args.stills) {
  for (const t of args.stills.split(',').map(Number)) {
    await frameAt(t, { path: `${OUT}still-${t}.png` });
    console.log(`out/still-${t}.png`);
  }
} else {
  const file = `${OUT}lightning-shop-day.mp4`;
  const ffmpeg = spawn('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))));
  const frames = Math.round(FPS * DURATION);
  for (let f = 0; f < frames; f += 1) {
    const png = await frameAt(f / FPS);
    if (!ffmpeg.stdin.write(png)) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
    if (f % FPS === 0) process.stdout.write(`\r${Math.round((f / frames) * 100)}%`);
  }
  ffmpeg.stdin.end();
  await done;
  // The poster is the intro title, for a <video poster> or a link preview.
  await frameAt(5, { path: `${OUT}poster.jpg`, type: 'jpeg', quality: 90 });
  console.log(`\r${file}`);
}
await browser.close();
