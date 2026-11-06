// Movement for the roaming lion: walk, sit, fly when thrown, bounce, land dizzy.
export type Mode = 'walk' | 'sit' | 'held' | 'air' | 'dizzy';
export type Body = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; mode: Mode; dir: 1 | -1; timer: number };
export type Bounds = { width: number; height: number; size: number };
export type Sample = { x: number; y: number; t: number };

const GRAVITY = 2200;
const RESTITUTION = 0.55;
const FLOOR_FRICTION = 0.86;
const WALK_SPEED = 60;
const MAX_THROW = 2600;
const BOUNCE_MIN = 380;
const EDGE = 10;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Advances the lion by dt seconds. `rnd` picks how long it walks or sits next. */
export function step(b: Body, dt: number, bounds: Bounds, rnd: () => number = Math.random): Body {
  const maxX = Math.max(0, bounds.width - bounds.size);
  const floor = Math.max(0, bounds.height - bounds.size);
  const n = { ...b };
  if (n.mode === 'held') return n;
  if (n.mode === 'air') {
    n.vy += GRAVITY * dt;
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    n.rot += n.vr * dt;
    if (n.x < 0) { n.x = 0; n.vx = -n.vx * RESTITUTION; n.vr = -n.vr * 0.6; }
    if (n.x > maxX) { n.x = maxX; n.vx = -n.vx * RESTITUTION; n.vr = -n.vr * 0.6; }
    if (n.y < 0) { n.y = 0; n.vy = -n.vy * RESTITUTION; }
    if (n.y >= floor) {
      n.y = floor;
      if (Math.abs(n.vy) > BOUNCE_MIN) { n.vy = -n.vy * RESTITUTION; n.vx *= FLOOR_FRICTION; n.vr *= 0.6; }
      else { Object.assign(n, { vy: 0, vx: 0, rot: 0, vr: 0, mode: 'dizzy' as Mode, timer: 1.4 }); }
    }
    return n;
  }
  n.y = floor;
  n.x = clamp(n.x, 0, maxX);
  n.timer -= dt;
  if (n.mode === 'walk') {
    n.x = clamp(n.x + n.dir * WALK_SPEED * dt, 0, maxX);
    if (n.x <= EDGE) n.dir = 1;
    if (n.x >= maxX - EDGE) n.dir = -1;
    if (n.timer <= 0) { n.mode = 'sit'; n.timer = 1.5 + rnd() * 2.5; }
  } else if (n.timer <= 0) {
    if (n.mode === 'sit') n.dir = rnd() < 0.5 ? -1 : 1;
    n.mode = 'walk';
    n.timer = 3 + rnd() * 4;
  }
  return n;
}

/** Turns the last few pointer samples into a throw (or a plain drop when the pointer barely moved). */
export function release(b: Body, samples: Sample[]): Body {
  const a = samples[0];
  const z = samples[samples.length - 1];
  const dt = Math.max(16, z.t - a.t) / 1000;
  const vx = clamp((z.x - a.x) / dt, -MAX_THROW, MAX_THROW);
  const vy = clamp((z.y - a.y) / dt, -MAX_THROW, MAX_THROW);
  return { ...b, mode: 'air', vx, vy, vr: vx * 0.4 };
}

export const isThrow = (b: Body) => Math.hypot(b.vx, b.vy) > 500;
