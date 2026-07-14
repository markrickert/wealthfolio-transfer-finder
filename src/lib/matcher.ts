import type { ActivityDetails, HostAPI } from '@wealthfolio/addon-sdk';
import { DEPOSIT, TRANSFER_IN, TRANSFER_OUT, WITHDRAWAL } from './activityTypes';
import {
  DEFAULT_SETTINGS,
  pairKey,
  type MatchSettings,
  type ProposedPair,
  type ScanProgress,
} from '../types/pair';

const MS_PER_DAY = 86_400_000;

function amountOf(activity: ActivityDetails): number {
  return Math.abs(Number(activity.amount ?? 0));
}

function currencyOf(activity: ActivityDetails): string {
  return activity.currency.trim().toUpperCase();
}

function timeOf(activity: ActivityDetails): number {
  // ActivityDetails.date is typed as Date, but crossing the addon sandbox's
  // postMessage boundary can hand it back as an ISO string - new Date(...)
  // coerces either shape.
  return new Date(activity.date).getTime();
}

function dateDiffDays(a: ActivityDetails, b: ActivityDetails): number {
  return Math.abs(timeOf(a) - timeOf(b)) / MS_PER_DAY;
}

interface Candidate {
  out: ActivityDetails;
  in: ActivityDetails;
  amountDiff: number;
  dayDiff: number;
}

function confidenceFor(amountDiff: number, dayDiff: number): { confidence: ProposedPair['confidence']; score: number } {
  if (amountDiff === 0 && dayDiff === 0) {
    return { confidence: 'high', score: 100 };
  }
  if (amountDiff === 0) {
    return { confidence: 'medium', score: Math.max(50, 90 - dayDiff * 8) };
  }
  return { confidence: 'low', score: Math.max(10, 60 - dayDiff * 8) };
}

function describe(candidate: Candidate): { reasons: string[]; warnings: string[] } {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (candidate.amountDiff === 0) {
    reasons.push('Exact amount match');
  } else {
    warnings.push(`Amount differs by ${candidate.amountDiff.toFixed(2)} (within tolerance)`);
  }

  if (candidate.dayDiff === 0) {
    reasons.push('Same day');
  } else {
    reasons.push(`${Math.round(candidate.dayDiff)} day(s) apart`);
  }

  return { reasons, warnings };
}

/**
 * Path B: WITHDRAWAL/DEPOSIT legs across different accounts that look like
 * the same real-world transfer but were never classified as one.
 *
 * Greedily assigns by nearest date-diff first (globally across the currency
 * bucket, not a naive left-to-right scan) so that recurring same-amount
 * transfers on different dates each match their own nearest counterpart
 * instead of cross-wiring to the wrong real pair.
 */
export function matchUnmarkedPairs(
  activities: ActivityDetails[],
  settings: MatchSettings = DEFAULT_SETTINGS,
): ProposedPair[] {
  const outflows = activities.filter((a) => a.activityType === WITHDRAWAL);
  const inflows = activities.filter((a) => a.activityType === DEPOSIT);

  const inflowsByCurrency = new Map<string, ActivityDetails[]>();
  for (const inflow of inflows) {
    const key = currencyOf(inflow);
    const bucket = inflowsByCurrency.get(key);
    if (bucket) {
      bucket.push(inflow);
    } else {
      inflowsByCurrency.set(key, [inflow]);
    }
  }

  const candidates: Candidate[] = [];
  for (const out of outflows) {
    const bucket = inflowsByCurrency.get(currencyOf(out)) ?? [];
    for (const inflow of bucket) {
      if (inflow.accountId === out.accountId) continue;

      const amountDiff = Math.abs(amountOf(out) - amountOf(inflow));
      if (amountDiff > settings.amountTolerance) continue;

      const dayDiff = dateDiffDays(out, inflow);
      if (dayDiff > settings.windowDays) continue;

      candidates.push({ out, in: inflow, amountDiff, dayDiff });
    }
  }

  candidates.sort((a, b) => a.dayDiff - b.dayDiff || a.amountDiff - b.amountDiff);

  const usedOut = new Set<string>();
  const usedIn = new Set<string>();
  const pairs: ProposedPair[] = [];

  for (const candidate of candidates) {
    if (usedOut.has(candidate.out.id) || usedIn.has(candidate.in.id)) continue;

    usedOut.add(candidate.out.id);
    usedIn.add(candidate.in.id);

    const { confidence, score } = confidenceFor(candidate.amountDiff, candidate.dayDiff);
    const { reasons, warnings } = describe(candidate);

    pairs.push({
      key: pairKey(candidate.out.id, candidate.in.id),
      source: 'reclassify',
      legOut: candidate.out,
      legIn: candidate.in,
      confidence,
      score,
      reasons,
      warnings,
    });
  }

  return pairs;
}

/**
 * Path A: activities already typed TRANSFER_IN/TRANSFER_OUT but not yet
 * linked to a pair. Delegates matching/scoring to the host's own
 * findTransferMatchCandidates rather than reimplementing it - the addon's
 * job here is only to find which legs are unpaired and call linkTransfer.
 *
 * ActivityDetails carries no sourceGroupId (the SDK deliberately omits it),
 * so "already paired" is determined by calling getTransferPair per leg: it
 * rejects when the activity has no existing pair.
 */
export async function findLinkedTransferCandidates(
  api: HostAPI,
  activities: ActivityDetails[],
  settings: MatchSettings = DEFAULT_SETTINGS,
  onProgress?: (progress: ScanProgress) => void,
): Promise<ProposedPair[]> {
  const byId = new Map(activities.map((a) => [a.id, a] as const));
  const transferLegs = activities.filter(
    (a) => a.activityType === TRANSFER_IN || a.activityType === TRANSFER_OUT,
  );

  // Cumulative across both sub-phases below: current/total only grow. total
  // steps up once matching starts, since unpaired.length isn't known until
  // the checking-pairs phase above finishes - that's a real increase, not a
  // reset.
  const unpaired: ActivityDetails[] = [];
  let checked = 0;
  await Promise.all(
    transferLegs.map(async (leg) => {
      try {
        await api.activities.getTransferPair(leg.id);
        // Resolves => leg already belongs to a pair, so it's not a candidate.
      } catch {
        unpaired.push(leg);
      } finally {
        checked += 1;
        onProgress?.({ stage: 'checking-pairs', current: checked, total: transferLegs.length });
      }
    }),
  );

  const unpairedIds = new Set(unpaired.map((leg) => leg.id));
  const usedIds = new Set<string>();
  const pairs: ProposedPair[] = [];

  let matched = 0;
  for (const leg of unpaired) {
    matched += 1;
    onProgress?.({
      stage: 'matching',
      current: transferLegs.length + matched,
      total: transferLegs.length + unpaired.length,
    });

    if (usedIds.has(leg.id)) continue;

    let candidates;
    try {
      candidates = await api.activities.findTransferMatchCandidates({
        activityId: leg.id,
        windowDays: settings.windowDays,
      });
    } catch {
      continue;
    }

    const best = candidates.find((c) => unpairedIds.has(c.activity.id) && !usedIds.has(c.activity.id));
    if (!best) continue;

    const counterpart = byId.get(best.activity.id);
    if (!counterpart) continue;

    usedIds.add(leg.id);
    usedIds.add(counterpart.id);

    const [legOut, legIn] = leg.activityType === TRANSFER_OUT ? [leg, counterpart] : [counterpart, leg];

    pairs.push({
      key: pairKey(leg.id, counterpart.id),
      source: 'linked-candidate',
      legOut,
      legIn,
      confidence: best.confidence,
      score: best.score,
      reasons: best.reasons,
      warnings: best.warnings,
    });
  }

  return pairs;
}
