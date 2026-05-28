import { describe, expect, it } from 'vitest';

import { GRAVITY_MS_BY_LEVEL } from '../constants';
import { gravityIntervalMs, levelFromLines, scoreFor } from './score';

describe('scoreFor', () => {
  it('returns 0 when no lines are cleared, regardless of level', () => {
    expect(scoreFor(0, 0)).toBe(0);
    expect(scoreFor(0, 5)).toBe(0);
    expect(scoreFor(0, 99)).toBe(0);
  });

  it('matches the NES scoring table at level 0', () => {
    expect(scoreFor(1, 0)).toBe(100);
    expect(scoreFor(2, 0)).toBe(300);
    expect(scoreFor(3, 0)).toBe(500);
    expect(scoreFor(4, 0)).toBe(800);
  });

  it('applies the (level + 1) multiplier', () => {
    expect(scoreFor(1, 1)).toBe(200);
    expect(scoreFor(4, 1)).toBe(1600);
    expect(scoreFor(4, 9)).toBe(8000);
  });
});

describe('levelFromLines', () => {
  it('advances one level for every 10 cleared lines', () => {
    expect(levelFromLines(0)).toBe(0);
    expect(levelFromLines(9)).toBe(0);
    expect(levelFromLines(10)).toBe(1);
    expect(levelFromLines(19)).toBe(1);
    expect(levelFromLines(20)).toBe(2);
    expect(levelFromLines(99)).toBe(9);
    expect(levelFromLines(100)).toBe(10);
  });
});

describe('gravityIntervalMs', () => {
  it('returns the level-0 interval (~1000 ms)', () => {
    expect(gravityIntervalMs(0)).toBe(GRAVITY_MS_BY_LEVEL[0]);
    expect(gravityIntervalMs(0)).toBe(1000);
  });

  it('returns the table value for in-range levels', () => {
    for (let level = 0; level < GRAVITY_MS_BY_LEVEL.length; level += 1) {
      expect(gravityIntervalMs(level)).toBe(GRAVITY_MS_BY_LEVEL[level]);
    }
  });

  it('clamps to the last table entry for levels beyond the table', () => {
    const lastIndex = GRAVITY_MS_BY_LEVEL.length - 1;
    const floor = GRAVITY_MS_BY_LEVEL[lastIndex];
    expect(gravityIntervalMs(15)).toBe(50);
    expect(gravityIntervalMs(lastIndex)).toBe(floor);
    expect(gravityIntervalMs(lastIndex + 1)).toBe(floor);
    expect(gravityIntervalMs(99)).toBe(floor);
    expect(gravityIntervalMs(99)).toBe(50);
  });
});
