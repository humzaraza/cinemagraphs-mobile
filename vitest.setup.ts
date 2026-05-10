// React Native exposes __DEV__ as a global at build time (Metro injects it).
// Vitest runs under Node and doesn't, so define it here. Tests run with
// __DEV__ truthy to match the dev environment, so any if (__DEV__) blocks
// in production code DO execute under tests.
(globalThis as Record<string, unknown>).__DEV__ = true;
