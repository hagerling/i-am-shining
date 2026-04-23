import { describe, it, expect } from 'vitest';
import {
  getIridescentStops,
  buildFrameDrawParams,
  clamp,
} from './canvas';

describe('clamp', () => {
  it('clamps below minimum', () => expect(clamp(-1, 0, 1)).toBe(0));
  it('clamps above maximum', () => expect(clamp(2, 0, 1)).toBe(1));
  it('passes through in-range values', () => expect(clamp(0.5, 0, 1)).toBe(0.5));
});

describe('getIridescentStops', () => {
  it('returns 7 color stops', () => {
    const stops = getIridescentStops(1);
    expect(stops).toHaveLength(7);
  });

  it('each stop has offset 0-1 and a CSS color string', () => {
    const stops = getIridescentStops(0.5);
    stops.forEach(([offset, color]) => {
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThanOrEqual(1);
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^hsla\(/);
    });
  });

  it('alpha scales with intensity', () => {
    const low = getIridescentStops(0.2);
    const high = getIridescentStops(1.0);
    const parseAlpha = (c: string) => parseFloat(c.match(/[\d.]+\)$/)![0]);
    expect(parseAlpha(low[0][1])).toBeLessThan(parseAlpha(high[0][1]));
  });
});

describe('buildFrameDrawParams', () => {
  it('returns x=0, y=0 for a square canvas', () => {
    const p = buildFrameDrawParams(500, 500);
    expect(p).toEqual({ x: 0, y: 0, size: 500 });
  });

  it('centers frame horizontally on landscape canvas', () => {
    const p = buildFrameDrawParams(800, 500);
    expect(p.size).toBe(500);
    expect(p.x).toBe(150);
    expect(p.y).toBe(0);
  });

  it('centers frame vertically on portrait canvas', () => {
    const p = buildFrameDrawParams(500, 800);
    expect(p.size).toBe(500);
    expect(p.x).toBe(0);
    expect(p.y).toBe(150);
  });
});
