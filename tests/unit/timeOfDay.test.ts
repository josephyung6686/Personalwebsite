import { describe, it, expect } from 'vitest';
import { timeOfDay } from '../../src/lib/timeOfDay';

describe('timeOfDay', () => {
  it.each([
    [4, 'night'], [5, 'sunset'], [6, 'sunset'], [7, 'day'], [16, 'day'],
    [17, 'sunset'], [19, 'sunset'], [20, 'night'], [0, 'night'], [23, 'night'],
  ] as const)('hour %i is %s', (hour, expected) => {
    expect(timeOfDay(hour)).toBe(expected);
  });
});
