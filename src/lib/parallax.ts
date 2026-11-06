/** Pixels each hero layer shifts at the hero's edge; farther layers move less. */
export const PARALLAX_DEPTH = { sky: 1.5, sun: 3, clouds: 6, scene: 10, lion: 16 } as const;

/** nx, ny: pointer position across the hero, -0.5..0.5. */
export function parallaxOffset(nx: number, ny: number, depth: number): { x: number; y: number } {
  return { x: -nx * depth, y: -ny * depth * 0.4 };
}
