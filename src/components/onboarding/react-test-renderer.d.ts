declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export interface ReactTestInstance {
    type: unknown;
    props: Record<string, unknown> & { children?: unknown };
    children: ReactTestInstance[];
    findByProps(props: Record<string, unknown>): ReactTestInstance;
    findAllByProps(props: Record<string, unknown>): ReactTestInstance[];
    findByType(type: unknown): ReactTestInstance;
    findAllByType(type: unknown): ReactTestInstance[];
  }

  export interface ReactTestRenderer {
    root: ReactTestInstance;
    toJSON(): unknown;
    unmount(): void;
  }

  export function create(element: ReactElement): ReactTestRenderer;
  export function act(callback: () => void | Promise<void>): void;

  const TestRenderer: {
    create: typeof create;
    act: typeof act;
  };

  export default TestRenderer;
}
