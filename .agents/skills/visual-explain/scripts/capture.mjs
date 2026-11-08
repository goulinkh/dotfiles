#!/usr/bin/env node
// Browser dependencies resolve from the output project, not the dotfiles skill.
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const [input, output, ...flags] = process.argv.slice(2);
if (!input || !output || flags.some(f => f !== '--frames' && !/^--fps=\d+$/.test(f))) {
  console.error('Usage: node capture.mjs scene.html NEW_OUTPUT_DIR [--frames] [--fps=30]');
  process.exit(1);
}
const fps = Number(flags.find(f => f.startsWith('--fps='))?.slice(6) ?? 30);
if (!Number.isInteger(fps) || fps < 1 || fps > 120) throw new Error('FPS must be 1–120');
const file = resolve(input), directory = resolve(output);
if (!(await stat(file)).isFile()) throw new Error('Input must be a local HTML file');
await mkdir(directory, { recursive: true });
if ((await readdir(directory)).length) throw new Error('Output directory must be empty; nothing was overwritten');
const require = createRequire(join(process.cwd(), 'package.json'));
let chromium;
try { ({ chromium } = require('playwright')); }
catch { throw new Error('Install playwright in the output project and run this command from that directory; see references/rendering.md'); }
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {})
});
const errors = [], network = [];
let context;
try {
  context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await context.route(/^https?:/, async route => {
    network.push(route.request().url());
    await route.abort();
  });
  async function openScene() {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.setDefaultTimeout(30000);
    await page.goto(pathToFileURL(file).href);
    await page.waitForFunction(() => typeof window.scene?.render === 'function');
    const metadata = await page.evaluate(async () => {
      const s = window.scene;
      if (!s.ready || typeof s.ready.then !== 'function') throw new Error('scene.ready must be a Promise');
      await Promise.race([s.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Scene readiness timed out')), 30000))]);
      s.setCaptureMode(true);
      return { duration: s.duration, width: s.width, height: s.height, chapters: s.chapters };
    });
    if (!Number.isFinite(metadata.duration) || metadata.duration <= 0) throw new Error('Invalid scene duration');
    for (const n of [metadata.width, metadata.height]) {
      if (!Number.isInteger(n) || n < 1 || n > 8192) throw new Error('Invalid scene dimensions');
    }
    if (!Array.isArray(metadata.chapters) || metadata.chapters.some(c => !Number.isFinite(c.time) || c.time < 0 || c.time > metadata.duration || typeof c.title !== 'string')) throw new Error('Invalid chapter metadata');
    await page.setViewportSize({ width: metadata.width, height: metadata.height });
    const stage = page.locator('#stage');
    await stage.waitFor({ state: 'visible' });
    const box = await stage.boundingBox();
    if (!box || Math.abs(box.width - metadata.width) > 1 || Math.abs(box.height - metadata.height) > 1) throw new Error('#stage must match scene.width/height in capture mode');
    return { page, stage, metadata };
  }
  async function shot(scene, t) {
    await scene.page.evaluate(t => window.scene.render(t), t);
    return scene.stage.screenshot({ type: 'png' });
  }
  const hash = data => createHash('sha256').update(data).digest('hex');
  const first = await openScene();
  const { duration, chapters } = first.metadata;
  const clamp = t => Math.min(duration, Math.max(0, t));
  const beats = [...new Set([0, duration / 4, duration / 2, duration * 3 / 4, duration, ...chapters.flatMap(c => [clamp(c.time - 1 / fps), c.time, clamp(c.time + 1 / fps)])])].sort((a, b) => a - b);
  const verified = [];
  const fresh = await openScene();
  for (let i = 0; i < beats.length; i++) {
    const t = beats[i];
    const a = await shot(first, t);
    await shot(first, duration - t);
    await shot(first, 0);
    const b = await shot(first, t);
    // Reload for every sample: this is a genuine fresh-load comparison.
    if (i) {
      await fresh.page.close();
      Object.assign(fresh, await openScene());
    }
    const c = await shot(fresh, t);
    if (hash(a) !== hash(b) || hash(a) !== hash(c)) throw new Error(`Non-deterministic frame at ${t}s`);
    await writeFile(join(directory, `sample-${String(i).padStart(3, '0')}.png`), a);
    verified.push({ time: t, sha256: hash(a) });
  }
  await fresh.page.close();
  let frameCount = 0;
  if (flags.includes('--frames')) {
    frameCount = Math.ceil(duration * fps);
    for (let i = 0; i < frameCount; i++) {
      await writeFile(join(directory, `frame-${String(i).padStart(6, '0')}.png`), await shot(first, i / fps));
    }
  }
  if (network.length || errors.length) throw new Error(JSON.stringify({ browserErrors: errors, blockedNetworkRequests: network }, null, 2));
  const report = { ...first.metadata, fps, frameCount, verified, browserErrors: errors, blockedNetworkRequests: network, note: 'Determinism checked at sampled times, not proof for all times. Inspect samples visually and audit against sources.' };
  await writeFile(join(directory, 'capture.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Verified ${verified.length} timestamps; captured ${frameCount} video frames in ${directory}`);
} finally {
  await context?.close();
  await browser.close();
}
