import type { ActivityDetails } from '@wealthfolio/addon-sdk';

export type MatchConfidence = 'high' | 'medium' | 'low';

/**
 * 'reclassify' pairs need at least one leg's activityType changed to
 * TRANSFER_OUT/TRANSFER_IN before they can be linked - see reclassifyOut/
 * reclassifyIn for which leg(s). This includes mixed pairs (one leg already
 * a transfer, the other still a plain DEPOSIT/WITHDRAWAL), not just pairs
 * where both legs need reclassifying.
 * 'linked-candidate' pairs are already TRANSFER_IN/TRANSFER_OUT on both legs
 * and only need linkTransfer().
 */
export type MatchSource = 'reclassify' | 'linked-candidate';

export interface ProposedPair {
  key: string;
  source: MatchSource;
  /** Does legOut need its activityType changed to TRANSFER_OUT before linking? */
  reclassifyOut: boolean;
  /** Does legIn need its activityType changed to TRANSFER_IN before linking? */
  reclassifyIn: boolean;
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
