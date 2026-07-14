import { describe, expect, it } from 'vitest';
import type { ProposedPair } from '../types/pair';
import { combineProposedPairs } from './scan';

function pair(key: string): ProposedPair {
  return {
    key,
    source: 'reclassify',
    reclassifyOut: true,
    reclassifyIn: true,
    legOut: {} as ProposedPair['legOut'],
    legIn: {} as ProposedPair['legIn'],
    confidence: 'high',
    score: 100,
    reasons: [],
    warnings: [],
  };
}

describe('combineProposedPairs', () => {
  it('merges multiple pair lists', () => {
    const result = combineProposedPairs([[pair('a:b')], [pair('c:d')]]);
    expect(result.map((p) => p.key)).toEqual(['a:b', 'c:d']);
  });

  it('dedups by key across lists, first occurrence wins', () => {
    const first = pair('a:b');
    const second = { ...pair('a:b'), score: 1 };
    const result = combineProposedPairs([[first], [second]]);

    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(first.score);
  });

  it('drops pairs whose key is in the dismissed set', () => {
    const result = combineProposedPairs([[pair('a:b'), pair('c:d')]], new Set(['a:b']));
    expect(result.map((p) => p.key)).toEqual(['c:d']);
  });
});
