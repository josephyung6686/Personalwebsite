// Renders the hero's pixel-art layers (design/scene-src) to small native-size PNGs.
import { readFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SCENE_BOX = { viewBox: '0 14 320 112', width: 320, height: 112 };
const SKY_BOX = { viewBox: '0 0 320 200', width: 320, height: 200 };
const STATES = ['day', 'sunset', 'night'];

/** Inner markup of an <svg>, minus any filter wrapper groups (the crayon filter is applied in CSS). */
function inner(svg) {
  const body = svg.includes('<svg') ? svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>')) : svg;
  return body.replace(/<g filter="[^"]*">/g, '<g>');
}

function wrap(body, { viewBox, width, height }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}" shape-rendering="crispEdges">${body}</svg>`;
}

async function write(svg, outFile) {
  await sharp(Buffer.from(svg)).png({ palette: true, compressionLevel: 9 }).toFile(outFile);
  return outFile;
}

export async function renderAll(srcDir, outDir) {
  mkdirSync(outDir, { recursive: true });
  const read = (f) => readFileSync(join(srcDir, f), 'utf8');
  const skies = read('skies.html');
  const jobs = [];
  for (const s of STATES) {
    jobs.push(write(wrap(inner(read(`scene-${s}.svg`)), SCENE_BOX), join(outDir, `scene-${s}.png`)));
    jobs.push(write(wrap(inner(read(`clouds-${s}.svg`)), SKY_BOX), join(outDir, `clouds-${s}.png`)));
    const sky = skies.match(new RegExp(`<svg class="sky sky-${s}"[\\s\\S]*?</svg>`))[0];
    jobs.push(write(wrap(inner(sky), SKY_BOX), join(outDir, `sky-${s}.png`)));
  }
  jobs.push(write(wrap(inner(read('emissive.svg')), SCENE_BOX), join(outDir, 'emissive.png')));
  return Promise.all(jobs);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const files = await renderAll('design/scene-src', 'public/hero');
  console.log(`wrote ${files.length + 1} files`);
}

/** 1200×630 share image: the day sky and scene, scaled up with hard pixels. */
export async function renderOg(outPath, heroDir = 'public/hero') {
  const W = 1200, H = 630;
  const sky = await sharp(join(heroDir, 'sky-day.png')).resize(W, H, { kernel: 'nearest', fit: 'fill' }).toBuffer();
  const clouds = await sharp(join(heroDir, 'clouds-day.png')).resize(W, H, { kernel: 'nearest', fit: 'cover', position: 'bottom' }).toBuffer();
  const scene = await sharp(join(heroDir, 'scene-day.png')).resize(W, Math.round(W * 112 / 320), { kernel: 'nearest' }).toBuffer();
  const sceneH = Math.round(W * 112 / 320);
  await sharp(sky).composite([{ input: clouds }, { input: scene, top: H - sceneH, left: 0 }]).png().toFile(outPath);
}
