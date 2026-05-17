import { describe, it, expect } from 'vitest';
import { formatScore } from './score-format';

describe('formatScore', () => {
  it('renders 8.4 as "8.4"', () => {
    expect(formatScore(8.4)).toBe('8.4');
  });

  it('renders 9.2 as "9.2"', () => {
    expect(formatScore(9.2)).toBe('9.2');
  });

  it('renders 10 as "10.0" so integer scores still show a decimal', () => {
    expect(formatScore(10)).toBe('10.0');
  });

  it('renders 0 as "0.0"', () => {
    expect(formatScore(0)).toBe('0.0');
  });

  it('renders 7 as "7.0"', () => {
    expect(formatScore(7)).toBe('7.0');
  });

  it('rounds 8.45 up to "8.5" (standard half-up)', () => {
    expect(formatScore(8.45)).toBe('8.5');
  });

  it('rounds 8.44 down to "8.4"', () => {
    expect(formatScore(8.44)).toBe('8.4');
  });

  it('rounds 8.449999 down to "8.4"', () => {
    expect(formatScore(8.449999)).toBe('8.4');
  });

  it('handles small floating-point drift like 8.1 + 0.2 = 8.3', () => {
    expect(formatScore(8.1 + 0.2)).toBe('8.3');
  });
});
