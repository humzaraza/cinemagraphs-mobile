import { describe, it, expect, vi } from 'vitest';

// Native modules must be mocked before importing the component so its
// top-level imports resolve under Node (vitest runs on Node, not RN).

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  Dimensions: { get: () => ({ width: 375, height: 812 }) },
}));

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Svg: 'Svg',
  Line: 'Line',
  Path: 'Path',
}));

import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import ReviewBeatArc from './ReviewBeatArc';
import { colors } from '../constants/theme';
import type { FilmDataPoint } from '../types/film';

const POINTS: FilmDataPoint[] = [
  { timeMidpoint: 10, score: 6, label: 'Opening' },
  { timeMidpoint: 45, score: 9, label: 'Climax' },
  { timeMidpoint: 90, score: 7, label: 'Resolution' },
];

function render(
  dataPoints: FilmDataPoint[],
  beatRatings: Record<string, number> | null,
): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  TestRenderer.act(() => {
    tree = TestRenderer.create(
      <ReviewBeatArc dataPoints={dataPoints} beatRatings={beatRatings} />,
    );
  });
  if (!tree) throw new Error('renderer never assigned');
  return tree;
}

// The two series are the only Path elements; legend swatches render as Lines.
function seriesPaths(tree: ReactTestRenderer) {
  return tree.root.findAllByType('Path' as never);
}

// A path's point count is its command count: one M plus one L per point.
function pointCount(d: string): number {
  return (d.match(/[ML]/g) ?? []).length;
}

describe('ReviewBeatArc', () => {
  it('renders nothing when beatRatings is null', () => {
    const tree = render(POINTS, null);
    expect(tree.toJSON()).toBeNull();
  });

  it('renders nothing with a single data point', () => {
    const tree = render([POINTS[0]], { Opening: 7 });
    expect(tree.toJSON()).toBeNull();
  });

  it('renders the film arc with a gold solid stroke and the beats with a dashed teal stroke', () => {
    const tree = render(POINTS, { Opening: 4, Climax: 10, Resolution: 6.5 });
    const paths = seriesPaths(tree);
    expect(paths).toHaveLength(2);

    const gold = paths.find((p) => p.props.stroke === colors.gold);
    const teal = paths.find((p) => p.props.stroke === colors.teal);
    expect(gold).toBeDefined();
    expect(teal).toBeDefined();

    expect(gold!.props.strokeDasharray).toBeUndefined();
    expect(gold!.props.opacity).toBe(0.6);
    expect(gold!.props.strokeWidth).toBe(2);

    expect(teal!.props.strokeDasharray).toBe('5 3');
    expect(teal!.props.opacity).toBe(0.8);
    expect(teal!.props.strokeWidth).toBe(2);

    // Fully matched ratings: both series span every data point.
    expect(pointCount(gold!.props.d)).toBe(POINTS.length);
    expect(pointCount(teal!.props.d)).toBe(POINTS.length);
  });

  it('drops beat ratings whose labels match no data point and skips unrated beats', () => {
    // 'Climax' is unrated and 'Not A Beat' matches nothing, so the teal
    // series holds only Opening and Resolution. The gold film arc still
    // spans all data points.
    const tree = render(POINTS, { Opening: 7, Resolution: 3, 'Not A Beat': 9 });
    const paths = seriesPaths(tree);

    const gold = paths.find((p) => p.props.stroke === colors.gold);
    const teal = paths.find((p) => p.props.stroke === colors.teal);
    expect(pointCount(gold!.props.d)).toBe(3);
    expect(pointCount(teal!.props.d)).toBe(2);
  });

  it('renders a legend naming both series', () => {
    const tree = render(POINTS, { Opening: 7 });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Film arc');
    expect(json).toContain("This review's beats");
  });
});
