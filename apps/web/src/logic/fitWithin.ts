import type { PixelSize } from './PixelSize';

/** Scales a size down, keeping its proportions, so its longest side is at most `maxSide`; never scales up. */
export function fitWithin(width: number, height: number, maxSide: number): PixelSize {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
