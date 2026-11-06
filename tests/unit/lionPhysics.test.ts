import { describe, it, expect } from 'vitest';
import { step, release, type Body } from '../../src/lib/lionPhysics';

const bounds = { width: 1000, height: 800, size: 80 };
const floorY = bounds.height - bounds.size;
const base = (o: Partial<Body>): Body => ({ x: 100, y: floorY, vx: 0, vy: 0, rot: 0, vr: 0, mode: 'walk', dir: 1, timer: 5, ...o });

describe('Lion physics', () => {
  it('gravity pulls a thrown lion down', () => {
    const b = step(base({ mode: 'air', y: 100, vy: 0 }), 0.016, bounds);
    expect(b.vy).toBeGreaterThan(0);
    expect(b.y).toBeGreaterThan(100);
  });
  it('bounces off the right wall, slower and reversed', () => {
    const b = step(base({ mode: 'air', x: 915, y: 200, vx: 1000 }), 0.016, bounds);
    expect(b.x).toBeLessThanOrEqual(bounds.width - bounds.size);
    expect(b.vx).toBeLessThan(0);
    expect(Math.abs(b.vx)).toBeLessThan(1000);
  });
  it('a hard landing bounces; a soft one lands dizzy', () => {
    expect(step(base({ mode: 'air', y: floorY - 1, vy: 1500 }), 0.016, bounds).vy).toBeLessThan(0);
    const soft = step(base({ mode: 'air', y: floorY - 1, vy: 100 }), 0.016, bounds);
    expect(soft.mode).toBe('dizzy');
    expect(soft.y).toBe(floorY);
  });
  it('walking turns around at the edges', () => {
    expect(step(base({ x: 1, dir: -1 }), 0.016, bounds).dir).toBe(1);
    expect(step(base({ x: bounds.width - bounds.size - 1, dir: 1 }), 0.016, bounds).dir).toBe(-1);
  });
  it('stays inside the screen after a resize', () => {
    const b = step(base({ x: 2000 }), 0.016, bounds);
    expect(b.x).toBeLessThanOrEqual(bounds.width - bounds.size);
  });
  it('release turns pointer movement into a capped throw', () => {
    const b = release(base({ mode: 'held' }), [{ x: 0, y: 500, t: 0 }, { x: 600, y: 0, t: 100 }]);
    expect(b.mode).toBe('air');
    expect(b.vx).toBeCloseTo(2600);
    expect(b.vy).toBeLessThan(0);
  });
  it('a still release just drops the lion', () => {
    expect(release(base({ mode: 'held', y: 300 }), [{ x: 10, y: 10, t: 0 }, { x: 10, y: 10, t: 100 }]).vx).toBe(0);
  });
});
