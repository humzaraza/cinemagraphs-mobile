import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks for native modules must precede the import of the file under test
// so that its top-level imports resolve under Node.

const { appState, emitAppState, pathnameRef, authRef } = vi.hoisted(() => {
  const listeners = new Set<(state: string) => void>();
  const appState = {
    currentState: 'active',
    listeners,
    addEventListener: (_type: string, handler: (state: string) => void) => {
      listeners.add(handler);
      return { remove: () => listeners.delete(handler) };
    },
  };
  return {
    appState,
    emitAppState: (state: string) => {
      appState.currentState = state;
      listeners.forEach((listener) => listener(state));
    },
    pathnameRef: { current: '/explore' },
    authRef: { current: { isAuthenticated: true } },
  };
});

vi.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { create: (s: Record<string, unknown>) => s, absoluteFill: {} },
  AppState: appState,
}));

vi.mock('expo-router', () => {
  const Tabs = ({ children }: { children?: React.ReactNode }) => children ?? null;
  Tabs.Screen = () => null;
  return {
    Tabs,
    Redirect: () => null,
    usePathname: () => pathnameRef.current,
  };
});

vi.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
vi.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({
  default: 'MaterialCommunityIcons',
}));
vi.mock('@expo/vector-icons/Ionicons', () => ({ default: 'Ionicons' }));

vi.mock('../providers/AuthProvider', () => ({
  useAuth: () => authRef.current,
}));

vi.mock('../lib/api', () => ({
  fetchUnreadActivity: vi.fn(),
}));

import React from 'react';
import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import { fetchUnreadActivity } from '../lib/api';
import { setUnreadActivity, getUnreadActivity } from '../lib/unread-activity';
import TabLayout from '../../app/(tabs)/_layout';

const fetchMock = vi.mocked(fetchUnreadActivity);

// Matches UNREAD_POLL_INTERVAL_MS in app/(tabs)/_layout.tsx.
const POLL_MS = 60_000;

async function renderLayout(): Promise<ReactTestRenderer> {
  let tree: ReactTestRenderer;
  await TestRenderer.act(async () => {
    tree = TestRenderer.create(<TabLayout />);
  });
  return tree!;
}

async function advance(ms: number) {
  await TestRenderer.act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

async function transitionTo(state: string) {
  await TestRenderer.act(async () => {
    emitAppState(state);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(true);
  appState.listeners.clear();
  appState.currentState = 'active';
  pathnameRef.current = '/explore';
  authRef.current = { isAuthenticated: true };
  setUnreadActivity(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('unread activity polling', () => {
  it('re-fetches the unread flag when the app returns to the foreground', async () => {
    const tree = await renderLayout();
    // One call from the mount seed.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await transitionTo('background');
    await transitionTo('active');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getUnreadActivity()).toBe(true);
    tree.unmount();
  });

  it('polls on the interval while the app stays active', async () => {
    const tree = await renderLayout();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advance(POLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await advance(POLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    tree.unmount();
  });

  it('stops the interval while the app is backgrounded', async () => {
    const tree = await renderLayout();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await transitionTo('background');
    await advance(POLL_MS * 3);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  it('restarts the interval when the app foregrounds again', async () => {
    const tree = await renderLayout();
    await transitionTo('background');
    await advance(POLL_MS * 2);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Foregrounding does an immediate re-fetch, then interval ticks resume.
    await transitionTo('active');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(POLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    tree.unmount();
  });

  it('does not poll while the Activity screen is focused', async () => {
    pathnameRef.current = '/activity';
    const tree = await renderLayout();
    // The mount seed still runs; only the polling effect is suspended.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advance(POLL_MS * 3);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Foreground transitions are also ignored while Activity is focused.
    await transitionTo('background');
    await transitionTo('active');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  it('resumes polling after navigating away from the Activity screen', async () => {
    pathnameRef.current = '/activity';
    const tree = await renderLayout();
    await advance(POLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    pathnameRef.current = '/explore';
    await TestRenderer.act(async () => {
      tree.update(<TabLayout />);
    });
    await advance(POLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    tree.unmount();
  });

  it('makes no requests when not authenticated', async () => {
    authRef.current = { isAuthenticated: false };
    const tree = await renderLayout();

    await advance(POLL_MS * 3);
    await transitionTo('background');
    await transitionTo('active');

    expect(fetchMock).not.toHaveBeenCalled();
    tree.unmount();
  });

  it('cleans up the interval and AppState listener on unmount', async () => {
    const tree = await renderLayout();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(appState.listeners.size).toBe(1);

    await TestRenderer.act(async () => {
      tree.unmount();
    });

    expect(appState.listeners.size).toBe(0);
    await advance(POLL_MS * 3);
    await TestRenderer.act(async () => {
      emitAppState('active');
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
