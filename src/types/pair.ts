import type { ActivityDetails } from '@wealthfolio/addon-sdk';

export type MatchConfidence = 'high' | 'medium' | 'low';

/**
 * 'reclassify' pairs are DEPOSIT/WITHDRAWAL legs that must have their
 * activityType changed to TRANSFER_IN/TRANSFER_OUT before they can be linked.
 * 'linked-candidate' pairs are already TRANSFER_IN/TRANSFER_OUT and only need
 * linkTransfer().
 */
export type MatchSource = 'reclassify' | 'linked-candidate';

export interface ProposedPair {
  key: string;
  source: MatchSource;
  legOut: ActivityDetails;
  legIn: ActivityDetails;
  confidence: MatchConfidence;
  score: number;
  reasons: string[];
  warnings: string[];
}

export interface MatchSettings {
  windowDays: number;
  amountTolerance: number;
}

export const DEFAULT_SETTINGS: MatchSettings = {
  windowDays: 5,
  amountTolerance: 1,
};

export function pairKey(idA: string, idB: string): string {
  return [idA, idB].sort().join(':');
}

/**
 * Cumulative across the whole scan, not per-stage: `current`/`total` only
 * ever grow. `total` can step up when a later phase's size becomes known
 * (e.g. we don't know how many transfer legs need checking until fetching
 * finishes) - that's a legitimate increase, never a reset back to a small
 * per-stage total.
 */
export interface ScanProgress {
  stage: 'fetching' | 'checking-pairs' | 'matching';
  current: number;
  total: number;
}
