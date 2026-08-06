import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { timeAgo } from './time-ago';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-06T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('timeAgo', () => {
  it('formats each unit compactly', () => {
    expect(timeAgo('2026-08-06T11:55:00Z')).toBe('5m ago');
    expect(timeAgo('2026-08-06T09:00:00Z')).toBe('3h ago');
    expect(timeAgo('2026-08-04T12:00:00Z')).toBe('2d ago');
    expect(timeAgo('2026-06-01T12:00:00Z')).toBe('2mo ago');
  });

  it('clamps future timestamps to zero instead of going negative', () => {
    expect(timeAgo('2026-08-06T12:00:30Z')).toBe('0m ago');
  });
});
