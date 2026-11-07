// The share image: the crayon campus at night, the lion at its laptop, and the name in wax. Composed in a real browser so the
// layers and the subtitle's font match the site. Run after render-scene.mjs and render-lion.mjs: node scripts/render-og.mjs
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { poseSvg } from '../src/assets/lion/poses.ts';

const b64 = (f) => readFileSync(f).toString('base64');
const webp = (f) => `data:image/webp;base64,${b64(f)}`;
const font = b64('node_modules/@fontsource/lexend/files/lexend-latin-500-normal.woff2');
// A share image has to stand alone, so the lion's layers go in as data rather than links.
const lion = poseSvg('laptop').replace(/href="\/lion\/([^"]+)"/g, (_, f) => `href="${webp(`public/lion/${f}`)}"`);

const html = `<!doctype html><html><head><style>
@font-face { font-family: L; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 500; }
html, body { margin: 0; }
.card { position: relative; width: 1200px; height: 630px; overflow: hidden; background: #22376f; font-family: L; color: #fffdf6; }
.card > img { position: absolute; }
.sky { inset: 0; width: 100%; height: 100%; }
.moon { right: 13%; top: 40px; width: 120px; }
.scene { left: 0; bottom: 0; width: 100%; }
.glow { left: 0; bottom: 0; width: 100%; }
.name { left: 40px; top: 24px; width: 440px; }
p { position: absolute; left: 52px; top: 204px; margin: 0; font-size: 23px; line-height: 1.35; font-weight: 500; }
.lion { position: absolute; left: 44px; bottom: 0; width: 190px; line-height: 0; }
.lion svg { width: 100%; height: auto; overflow: visible; display: block; }
</style></head><body><div class="card">
<img class="sky" src="${webp('public/hero/sky-night.webp')}" alt="" />
<img class="moon" src="${webp('public/hero/moon.webp')}" alt="" />
<img class="scene" src="${webp('public/hero/scene-night.webp')}" alt="" />
<img class="glow" src="${webp('public/hero/emissive.webp')}" alt="" />
<img class="name" src="${webp('public/hero/name-cream.webp')}" alt="" />
<p>CS + Financial Engineering · Columbia University</p>
<div class="lion">${lion}</div>
</div></body></html>`;

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({ path: 'public/og.png' });
await browser.close();
console.log('wrote public/og.png');
