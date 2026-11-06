export type TimeOfDay = 'day' | 'sunset' | 'night';

/** Day 7:00–16:59, sunset 17:00–19:59 and dawn 5:00–6:59, night otherwise (visitor's local hour). */
export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 7 && hour < 17) return 'day';
  if ((hour >= 17 && hour < 20) || (hour >= 5 && hour < 7)) return 'sunset';
  return 'night';
}

/** The scene's time for now: always night. Set to null to follow the visitor's clock again. */
export const FIXED_TIME: TimeOfDay | null = 'night';
export const sceneTime = (hour: number): TimeOfDay => FIXED_TIME ?? timeOfDay(hour);
