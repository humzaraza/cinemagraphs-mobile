import { describe, it, expect } from 'vitest';
import { getInitials } from './initials';

describe('getInitials', () => {
  it('returns the first letter of a single-word name', () => {
    expect(getInitials('Humza')).toBe('H');
  });

  it('returns two initials for a multi-word name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('caps at two initials for longer names', () => {
    expect(getInitials('John Ronald Reuel Tolkien')).toBe('JR');
  });

  it('ignores extra whitespace between and around words', () => {
    expect(getInitials('  John   Doe ')).toBe('JD');
  });

  it('handles a single character', () => {
    expect(getInitials('j')).toBe('J');
  });

  it('returns an empty string for an empty string', () => {
    expect(getInitials('')).toBe('');
  });
});
