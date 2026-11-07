// Turns a headless wax sheet into an image file. Every crayon image on the site goes through here.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';

export const toSharp = (sheet) => sharp(Buffer.from(sheet.px.buffer, sheet.px.byteOffset, sheet.px.byteLength), { raw: { width: sheet.W, height: sheet.H, channels: 4 } });

export async function saveWebp(sheet, path, { quality = 82, alphaQuality = 88 } = {}) {
  mkdirSync(dirname(path), { recursive: true });
  await toSharp(sheet).webp({ quality, alphaQuality, effort: 6 }).toFile(path);
  return path;
}
