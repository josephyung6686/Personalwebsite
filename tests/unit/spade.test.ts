import { describe, it, expect } from 'vitest';
import {
  BATCH, CELLS, DEFAULT_TARGET, GRID, MAX_ROUNDS, PRIOR_SD,
  certify, describeCell, describeStatus, hiddenYield, largestRect, newCampaign, posterior, recommend, runRound, summarize,
  type Campaign,
} from '../../src/components/spade/spadeMath';

const runTo = (rounds: number, target = DEFAULT_TARGET): Campaign => {
  let c = newCampaign();
  for (let i = 0; i < rounds; i++) c = runRound(c, target);
  return c;
};
const count = (m: Uint8Array) => m.reduce((a, b) => a + b, 0);

describe('Gaussian process posterior', () => {
  const obs = [{ x: 0.3, y: 0.3, value: 70 }, { x: 0.7, y: 0.6, value: 52 }];

  it('is close to the observation at a training point, within the noise it assumes', () => {
    // The fit is meant to smooth: it trusts a reading only as far as the noise (standard deviation 6) allows.
    const { mean } = posterior(obs, obs.map((o) => ({ x: o.x, y: o.y })));
    expect(Math.abs(mean[0] - 70)).toBeLessThan(3);
    expect(Math.abs(mean[1] - 52)).toBeLessThan(3);
  });

  it('is least sure far from data, and uncertainty shrinks toward a training point', () => {
    const { sd } = posterior(obs, [{ x: 0.3, y: 0.3 }, { x: 0.36, y: 0.3 }, { x: 0.46, y: 0.3 }, { x: 1, y: 0 }]);
    expect(sd[0]).toBeLessThan(sd[1]);
    expect(sd[1]).toBeLessThan(sd[2]);
    expect(sd[2]).toBeLessThan(sd[3]);
    expect(sd[3]).toBeLessThanOrEqual(PRIOR_SD);
  });

  it('with no data returns the prior everywhere', () => {
    const { sd, mean } = posterior([], CELLS);
    expect(sd.every((v) => v === PRIOR_SD)).toBe(true);
    expect(new Set(mean).size).toBe(1);
  });

  it('never gets less sure at any cell as a campaign adds experiments', () => {
    let c = newCampaign();
    for (let r = 0; r < MAX_ROUNDS; r++) {
      const next = runRound(c, DEFAULT_TARGET);
      next.post.sd.forEach((v, i) => expect(v).toBeLessThanOrEqual(c.post.sd[i] + 1e-6));
      c = next;
    }
  });
});

describe('campaign', () => {
  it('spends one batch per round and stops at the budget', () => {
    const c = runTo(2);
    expect(c.round).toBe(2);
    expect(c.obs).toHaveLength(2 * BATCH);
    const done = runTo(MAX_ROUNDS);
    expect(runRound(done, DEFAULT_TARGET)).toBe(done);
  });

  it('is deterministic for the seed, so Reset replays the same run', () => {
    expect(runTo(3).obs).toEqual(runTo(3).obs);
    expect(Array.from(runTo(3).post.mean)).toEqual(Array.from(runTo(3).post.mean));
  });

  it('never runs the same setting twice in a campaign', () => {
    const tested = runTo(MAX_ROUNDS).obs.map((o) => `${o.x},${o.y}`);
    expect(new Set(tested).size).toBe(MAX_ROUNDS * BATCH);
  });

  it('once it has data, the target changes where it spends experiments', () => {
    expect(runTo(4, 60).obs).not.toEqual(runTo(4, 80).obs);
  });
});

describe('certified region', () => {
  it('certifies nothing before any data', () => {
    expect(count(certify(newCampaign().post, DEFAULT_TARGET))).toBe(0);
  });

  it('a higher target can only shrink the region: the set is nested', () => {
    const { post } = runTo(MAX_ROUNDS);
    let wider = certify(post, 50);
    for (const t of [60, 70, 80, 90]) {
      const tighter = certify(post, t);
      tighter.forEach((v, i) => { if (v) expect(wider[i]).toBe(1); });
      wider = tighter;
    }
  });

  it('every cell it certifies truly clears the target, at every round and target, for this seed', () => {
    for (const target of [55, 60, 65, 70, 75, 80]) {
      let c = newCampaign();
      for (let r = 0; r < MAX_ROUNDS; r++) {
        c = runRound(c, target);
        const m = certify(c.post, target);
        m.forEach((v, i) => { if (v) expect(hiddenYield(CELLS[i].x, CELLS[i].y)).toBeGreaterThanOrEqual(target); });
      }
    }
  });

  it('is more certain with more data on the default run: first hold off, later a larger region', () => {
    const early = count(certify(runTo(1).post, DEFAULT_TARGET));
    const late = count(certify(runTo(MAX_ROUNDS).post, DEFAULT_TARGET));
    expect(early).toBe(0);
    expect(late).toBeGreaterThan(40);
  });
});

describe('largest rectangle', () => {
  const mask = (rows: string[]) => {
    const n = rows.length;
    const m = new Uint8Array(n * n);
    // Row 0 of the picture is the top row of the grid, so tests read like the map.
    rows.forEach((row, r) => [...row].forEach((ch, c) => { m[(n - 1 - r) * n + c] = ch === '#' ? 1 : 0; }));
    return { m, n };
  };

  it('returns null for an empty mask', () => {
    const { m, n } = mask(['....', '....', '....', '....']);
    expect(largestRect(m, n)).toBeNull();
  });

  it('finds the biggest full block, not the bounding box of an irregular shape', () => {
    const { m, n } = mask(['#...#', '.###.', '.###.', '.###.', '#...#']);
    expect(largestRect(m, n)).toEqual({ x0: 1, x1: 3, y0: 1, y1: 3 });
  });

  it('ignores one-cell-wide strips, which are not a range', () => {
    const { m, n } = mask(['#....', '#....', '#....', '#....', '#....']);
    expect(largestRect(m, n)).toBeNull();
  });

  it('every cell in the rectangle is certified', () => {
    const { post } = runTo(MAX_ROUNDS);
    const m = certify(post, DEFAULT_TARGET);
    const r = largestRect(m, GRID)!;
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) expect(m[y * GRID + x]).toBe(1);
  });
});

describe('what it tells the visitor', () => {
  it('starts by inviting the first round', () => {
    expect(describeStatus(newCampaign(), DEFAULT_TARGET).kind).toBe('start');
  });

  it('says plainly when it is holding off', () => {
    const s = describeStatus(runTo(1), DEFAULT_TARGET);
    expect(s.kind).toBe('hold');
    expect(s.headline).toBe('Not confident yet: holding off.');
  });

  it('eventually recommends a range, giving the range in factor units', () => {
    const s = describeStatus(runTo(MAX_ROUNDS), DEFAULT_TARGET);
    expect(s.kind).toBe('recommend');
    expect(s.headline).toMatch(/^Recommend: Glucose feed [\d.]+ to [\d.]+ g\/L, Seeding density [\d.]+ to [\d.]+ M cells\/mL\.$/);
  });

  it('at the default target it holds off first, then recommends by round 4, which the homepage preview relies on', () => {
    expect(describeStatus(runTo(2), DEFAULT_TARGET).kind).toBe('hold');
    expect(describeStatus(runTo(4), DEFAULT_TARGET).kind).toBe('recommend');
  });

  it('never recommends a target nothing in this space can reach, even at full budget', () => {
    const peak = Math.max(...CELLS.map((p) => hiddenYield(p.x, p.y)));
    const target = Math.ceil(peak) + 2;
    let c = newCampaign();
    for (let r = 0; r < MAX_ROUNDS; r++) {
      c = runRound(c, target);
      expect(describeStatus(c, target).kind).toBe('hold');
      expect(recommend(c.post, target)).toBeNull();
    }
    expect(describeStatus(c, target).headline).toBe('Budget spent: still holding off.');
  });

  it('reads out any cell in factor units with its bound', () => {
    const text = describeCell(runTo(3), GRID * 19 + 20, DEFAULT_TARGET);
    expect(text).toMatch(/^Glucose feed [\d.]+ g\/L, Seeding density [\d.]+ M cells\/mL: predicted \d+% ± \d+\. Lower bound -?\d+%, (clears|below) the target\.$/);
  });

  it('writes a text equivalent of the chart, with no em dashes anywhere', () => {
    for (const c of [newCampaign(), runTo(1), runTo(MAX_ROUNDS)]) {
      const s = describeStatus(c, DEFAULT_TARGET);
      const text = `${s.headline} ${s.detail} ${summarize(c, DEFAULT_TARGET)}`;
      expect(text).not.toMatch(/[—–]/);
    }
    expect(summarize(runTo(2), DEFAULT_TARGET)).toMatch(/Round 2 of 6/);
    expect(summarize(runTo(2), DEFAULT_TARGET)).toMatch(/16 experiments/);
  });
});
