// The share image: the night campus and the lion at its laptop, composed at sprite resolution (240 x 126) and scaled
// by exactly 5 to 1200 x 630 so every pixel stays even, then the name in the hero's pixel type.
// Run after render-scene.mjs: node scripts/render-og.mjs
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { poseSvg } from '../src/assets/lion/poses.ts';
import { spritePng } from './render-lion.mjs';

const W = 240, H = 126, SCALE = 5;
const hero = (f) => `public/hero/${f}.png`;
const crop = (input, top, height) => sharp(input).extract({ left: 0, top, width: W, height }).toBuffer();

// nightsky.svg draws the moon and stars on the sky's 320 x 200 grid; the hero animates them, this takes one still frame.
const nightsky = readFileSync('src/components/hero/nightsky.svg', 'utf8');
const sky = Buffer.from(nightsky.replace('<svg', '<svg width="320" height="200"'));

const native = await sharp({ create: { width: W, height: H, channels: 4, background: '#0b1226' } }).composite([
  { input: await crop(hero('sky-night'), 0, H), left: 0, top: 0 },
  { input: await crop(await sharp(sky).png().toBuffer(), 0, H), left: 0, top: 0 },
  { input: await crop(hero('clouds-night'), 200 - H, H), left: 0, top: 0 },
  { input: await crop(hero('scene-night'), 0, 112), left: 0, top: H - 112 },
  { input: await crop(hero('emissive'), 0, 112), left: 0, top: H - 112 },
  { input: await spritePng(poseSvg('laptop'), { w: 44, h: 44 }), left: 10, top: H - 44 },
]).png().toBuffer();
const scene = await sharp(native).resize(W * SCALE, H * SCALE, { kernel: 'nearest' }).png().toBuffer();
await sharp(scene).toFile('design/og-scene.png');

const b64 = (b) => Buffer.from(b).toString('base64');
const font = b64(readFileSync('node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2'));
const html = `<!doctype html><html><head><style>
@font-face { font-family: P; src: url(data:font/woff2;base64,${font}) format('woff2'); }
html, body { margin: 0; }
.card { position: relative; width: 1200px; height: 630px; overflow: hidden; background: url(data:image/png;base64,${b64(scene)}) 0 0 / 100% 100%; image-rendering: pixelated; font-family: P; color: #fff; }
h1 { position: absolute; left: 50px; top: 40px; margin: 0; font-size: 80px; line-height: 1.15; font-weight: 400; text-shadow: 5px 5px 0 #1d4f91, 10px 10px 0 #a9761b; }
p { position: absolute; left: 50px; top: 240px; margin: 0; font-size: 20px; line-height: 1.7; text-shadow: 3px 3px 0 #1d4f91; }
</style></head><body><div class="card"><h1>JOSEPH<br>YUNG</h1><p>CS + Financial Engineering<br>Columbia University</p></div></body></html>`;

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'public/og.png' });
await browser.close();
console.log('wrote public/og.png');
