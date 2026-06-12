import { describe, it, expect, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';
import {
  markReviewed,
  isReviewed,
  subscribe,
  useIsReviewed,
} from './reviewed-films';

// The store is module-level session state with no reset API (none is
// needed in production), so each test uses its own film id.

function renderHook(id: string) {
  const result = { current: false };
  function Harness() {
    result.current = useIsReviewed(id);
    return null;
  }
  TestRenderer.act(() => {
    TestRenderer.create(<Harness />);
  });
  return result;
}

describe('reviewed-films', () => {
  it('isReviewed is false for a film that was never marked', () => {
    expect(isReviewed('rf-unknown')).toBe(false);
  });

  it('isReviewed is true after markReviewed', () => {
    markReviewed('rf-marked');
    expect(isReviewed('rf-marked')).toBe(true);
  });

  it('notifies subscribers on mark, but not for an already-marked id', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    markReviewed('rf-notify');
    expect(listener).toHaveBeenCalledTimes(1);
    markReviewed('rf-notify');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    unsubscribe();
    markReviewed('rf-unsubscribed');
    expect(listener).not.toHaveBeenCalled();
  });

  it('useIsReviewed returns false initially and true after mark', () => {
    const result = renderHook('rf-hook');
    expect(result.current).toBe(false);
    TestRenderer.act(() => {
      markReviewed('rf-hook');
    });
    expect(result.current).toBe(true);
  });

  it('useIsReviewed returns true immediately for an already-marked id', () => {
    markReviewed('rf-premarked');
    const result = renderHook('rf-premarked');
    expect(result.current).toBe(true);
  });
});
