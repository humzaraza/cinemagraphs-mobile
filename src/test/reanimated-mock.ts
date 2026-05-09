// Vitest factory for mocking 'react-native-reanimated' in component tests.
// Reanimated 4's bundled mock.js requires its TypeScript source through Metro
// and crashes under Node, so component tests get this minimal stand-in instead.
//
// Usage in a test file:
//   vi.mock('react-native-reanimated', async () => {
//     const { createReanimatedMock } = await import('../../test/reanimated-mock');
//     return createReanimatedMock();
//   });
export function createReanimatedMock() {
  return {
    default: { View: 'AnimatedView' },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (cb: () => Record<string, unknown>) => cb(),
    withSpring: (target: number) => target,
    withTiming: (target: number) => target,
    withSequence: (...args: number[]) => args[args.length - 1] ?? 0,
  };
}
