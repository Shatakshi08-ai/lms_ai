import { describe, it, expect } from 'vitest';
import { THEMES } from './themes.js';

describe('lms themes', () => {
  it('exposes 30 named themes', () => {
    expect(Object.keys(THEMES)).toHaveLength(30);
    expect(THEMES['warm-library']).toBeTruthy();
  });
});
