import { describe, it, expect } from 'vitest';
import { parallaxOffset, PARALLAX_DEPTH } from '../../src/lib/parallax';

describe('parallaxOffset', () => {
  it('moves opposite the pointer, vertical damped to 40%', () => {
    const o = parallaxOffset(0.5, -0.5, 10);
    expect(o.x).toBeCloseTo(-5);
    expect(o.y).toBeCloseTo(2);
  });
  it('is still at the centre', () => {
    const o = parallaxOffset(0, 0, 16);
    expect(Math.abs(o.x)).toBe(0);
    expect(Math.abs(o.y)).toBe(0);
  });
  it('orders depths sky < sun < clouds < scene < lion', () => {
    const d = PARALLAX_DEPTH;
    expect(d.sky < d.sun && d.sun < d.clouds && d.clouds < d.scene && d.scene < d.lion).toBe(true);
  });
});
