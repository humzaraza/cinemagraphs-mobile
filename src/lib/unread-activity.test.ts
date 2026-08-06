import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setUnreadActivity,
  getUnreadActivity,
  subscribe,
} from './unread-activity';

// Module-level session state; reset to the initial false between tests.

beforeEach(() => {
  setUnreadActivity(false);
});

describe('unread-activity', () => {
  it('starts false and reflects the last set value', () => {
    expect(getUnreadActivity()).toBe(false);
    setUnreadActivity(true);
    expect(getUnreadActivity()).toBe(true);
    setUnreadActivity(false);
    expect(getUnreadActivity()).toBe(false);
  });

  it('notifies subscribers on change, but not on a same-value set', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    setUnreadActivity(true);
    expect(listener).toHaveBeenCalledTimes(1);
    setUnreadActivity(true);
    expect(listener).toHaveBeenCalledTimes(1);
    setUnreadActivity(false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    unsubscribe();
    setUnreadActivity(true);
    expect(listener).not.toHaveBeenCalled();
  });
});
