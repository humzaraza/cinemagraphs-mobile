import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  Pressable: 'Pressable',
  StyleSheet: {
    create: (s: Record<string, unknown>) => s,
    hairlineWidth: 1,
    absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  },
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import { AccumulationStrip } from './AccumulationStrip';
import { colors } from '../../constants/theme';
import type { CuratedFilm } from '../../data/onboardingCuration';

const A: CuratedFilm = { title: 'Alpha', year: 2000, posterPath: '/a.jpg' };
const B: CuratedFilm = { title: 'Bravo', year: 2001, posterPath: '/b.jpg' };
const C: CuratedFilm = { title: 'Charlie', year: 2002, posterPath: '/c.jpg' };
const D: CuratedFilm = { title: 'Delta', year: 2003, posterPath: '/d.jpg' };

function flatten(style: unknown): Record<string, unknown> {
  if (!style) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean).map(flatten));
  }
  return style as Record<string, unknown>;
}

function render(films: CuratedFilm[], height?: 'compact' | 'tall', label = 'YOUR PICKS') {
  let tree: ReactTestRenderer | undefined;
  TestRenderer.act(() => {
    tree = TestRenderer.create(
      <AccumulationStrip films={films} label={label} height={height} />,
    );
  });
  if (!tree) throw new Error('renderer never assigned');
  return tree;
}

describe('AccumulationStrip', () => {
  it('dedupes films by posterPath in first-seen order', () => {
    const tree = render([A, B, A, C, B, D]);
    const posters = tree.root.findAllByProps({ testID: 'accumulation-poster' });
    expect(posters).toHaveLength(4);
    const uris = posters.map((p) => (p.props.source as { uri: string }).uri);
    expect(uris[0]).toContain('/a.jpg');
    expect(uris[1]).toContain('/b.jpg');
    expect(uris[2]).toContain('/c.jpg');
    expect(uris[3]).toContain('/d.jpg');
  });

  it('empty films renders the label and zero posters', () => {
    const tree = render([], undefined, 'CHOSEN');
    const label = tree.root.findByProps({ children: 'CHOSEN' });
    expect(label).toBeTruthy();
    const posters = tree.root.findAllByProps({ testID: 'accumulation-poster' });
    expect(posters).toHaveLength(0);
  });

  it('compact applies width 24 and height 36 to each poster', () => {
    const tree = render([A, B, C], 'compact');
    const posters = tree.root.findAllByProps({ testID: 'accumulation-poster' });
    for (const p of posters) {
      const flat = flatten(p.props.style);
      expect(flat.width).toBe(24);
      expect(flat.height).toBe(36);
    }
  });

  it('tall applies width 18 and height 28 to each poster', () => {
    const tree = render([A, B, C], 'tall');
    const posters = tree.root.findAllByProps({ testID: 'accumulation-poster' });
    for (const p of posters) {
      const flat = flatten(p.props.style);
      expect(flat.width).toBe(18);
      expect(flat.height).toBe(28);
    }
  });

  it('LinearGradient is rendered exactly once', () => {
    const tree = render([A, B, C]);
    const grads = tree.root.findAllByProps({ testID: 'accumulation-fade-gradient' });
    expect(grads).toHaveLength(1);
  });

  it('band container has backgroundColor bandBackground', () => {
    const tree = render([A]);
    const band = tree.root.findByProps({ testID: 'accumulation-band' });
    const flat = flatten(band.props.style);
    expect(flat.backgroundColor).toBe(colors.bandBackground);
  });

  it('compact band has height 56', () => {
    const tree = render([A], 'compact');
    const band = tree.root.findByProps({ testID: 'accumulation-band' });
    const flat = flatten(band.props.style);
    expect(flat.height).toBe(56);
  });

  it('tall band has height 64', () => {
    const tree = render([A], 'tall');
    const band = tree.root.findByProps({ testID: 'accumulation-band' });
    const flat = flatten(band.props.style);
    expect(flat.height).toBe(64);
  });

  it('label has color labelGold', () => {
    const tree = render([A], undefined, 'YOUR PICKS');
    const labelNode = tree.root.findByProps({ children: 'YOUR PICKS' });
    const flat = flatten(labelNode.props.style);
    expect(flat.color).toBe(colors.labelGold);
  });
});
