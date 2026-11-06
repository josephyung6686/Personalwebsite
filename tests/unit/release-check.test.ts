import { describe, it, expect } from 'vitest';
// @ts-expect-error plain JS module
import { findPlaceholders, checkRelease } from '../../scripts/release-check.mjs';

describe('release check', () => {
  it('finds TODO placeholders anywhere in nested data', () => {
    expect(findPlaceholders({ a: 'ok', b: ['x', { devpost: '[TODO: Devpost]' }] })).toEqual(['b.1.devpost']);
  });
  it('blocks a production build that still has placeholders', () => {
    expect(() => checkRelease('production', { email: '[TODO: email]' })).toThrow(/email/);
  });
  it('lets previews and local builds through', () => {
    expect(() => checkRelease('preview', { email: '[TODO: email]' })).not.toThrow();
    expect(() => checkRelease(undefined, { email: '[TODO: email]' })).not.toThrow();
  });
});
