import type { ActivityDetails, HostAPI } from "@wealthfolio/addon-sdk";
import { DEPOSIT, TRANSFER_IN, TRANSFER_OUT, WITHDRAWAL } from "./activityTypes";
import {
  DEFAULT_SETTINGS,
  pairKey,
  type MatchSettings,
  type ProposedPair,
  type ScanProgress,
} from "../types/pair";

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

/** First index in a time-sorted array whose activity time is >= `time`. */
function lowerBoundByTime(sorted: ActivityDetails[], time: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (timeOf(sorted[mid]) < time) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

interface Candidate {
  out: ActivityDetails;
  in: ActivityDetails;
  amountDiff: number;
  dayDiff: number;
}

function confidenceFor(
  amountDiff: number,
  dayDiff: number,
): { confidence: ProposedPair["confidence"]; score: number } {
  if (amountDiff === 0 && dayDiff === 0) {
    return { confidence: "high", score: 100 };
  }
  if (amountDiff === 0) {
    return { confidence: "medium", score: Math.max(50, 90 - dayDiff * 8) };
  }
  return { confidence: "low", score: Math.max(10, 60 - dayDiff * 8) };
}

function describe(candidate: Candidate): { reasons: string[]; warnings: string[] } {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (candidate.amountDiff === 0) {
    reasons.push("Exact amount");
  } else {
    warnings.push(`Amount differs by ${candidate.amountDiff.toFixed(2)}`);
  }

  if (candidate.dayDiff === 0) {
    reasons.push("Same day");
  } else {
    reasons.push(`${Math.round(candidate.dayDiff)} day(s) apart`);
  }

  return { reasons, warnings };
}

/**
 * Path B: DEPOSIT/WITHDRAWAL legs that look like the same real-world
 * transfer but were never classified as one - including MIXED pairs where
 * one leg is already TRANSFER_IN/TRANSFER_OUT (but not yet linked to
 * anything) and the other is still a plain DEPOSIT/WITHDRAWAL. Only the
 * plain leg(s) need reclassifying in that case; see reclassifyOut/In.
 *
 * The pure TRANSFER_OUT+TRANSFER_IN combination is deliberately excluded -
 * that's handled by findLinkedTransferCandidates (Path A) using the host's
 * own matcher instead of this heuristic.
 *
 * Greedily assigns by nearest date-diff first (globally across the currency
 * bucket, not a naive left-to-right scan) so that recurring same-amount
 * transfers on different dates each match their own nearest counterpart
 * instead of cross-wiring to the wrong real pair.
 *
 * Candidates are bounded by date via a sorted-bucket binary search rather
 * than comparing every outflow against every inflow in the currency - as
 * transaction history grows over the years, most of it falls outside the
 * match window anyway, so this keeps the comparison cost proportional to
 * "activity near this date" instead of "all activity ever."
 */
export function matchUnmarkedPairs(
  activities: ActivityDetails[],
  settings: MatchSettings = DEFAULT_SETTINGS,
  dismissed: ReadonlySet<string> = new Set(),
  unpairedTransferIds: ReadonlySet<string> = new Set(),
): ProposedPair[] {
  const outflows = activities.filter(
    (a) =>
      a.activityType === WITHDRAWAL ||
      (a.activityType === TRANSFER_OUT && unpairedTransferIds.has(a.id)),
  );
  const inflows = activities.filter(
    (a) =>
      a.activityType === DEPOSIT ||
      (a.activityType === TRANSFER_IN && unpairedTransferIds.has(a.id)),
  );

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
  for (const bucket of inflowsByCurrency.values()) {
    bucket.sort((a, b) => timeOf(a) - timeOf(b));
  }

  const windowMs = settings.windowDays * MS_PER_DAY;
  const candidates: Candidate[] = [];
  for (const out of outflows) {
    const bucket = inflowsByCurrency.get(currencyOf(out)) ?? [];
    const outTime = timeOf(out);
    const startIdx = lowerBoundByTime(bucket, outTime - windowMs);

    for (let i = startIdx; i < bucket.length; i += 1) {
      const inflow = bucket[i];
      if (timeOf(inflow) > outTime + windowMs) break; // bucket is sorted - nothing further can be in range

      // Both legs already transfer-typed is Path A's exclusive job (it uses
      // the host's own matcher, which is more authoritative for that combo).
      if (out.activityType === TRANSFER_OUT && inflow.activityType === TRANSFER_IN) continue;

      if (inflow.accountId === out.accountId) continue;
      if (dismissed.has(pairKey(out.id, inflow.id))) continue;

      const amountDiff = Math.abs(amountOf(out) - amountOf(inflow));
      if (amountDiff > settings.amountTolerance) continue;

      candidates.push({ out, in: inflow, amountDiff, dayDiff: dateDiffDays(out, inflow) });
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
      source: "reclassify",
      reclassifyOut: candidate.out.activityType !== TRANSFER_OUT,
      reclassifyIn: candidate.in.activityType !== TRANSFER_IN,
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

export interface UnpairedTransferLegs {
  legs: ActivityDetails[];
  ids: Set<string>;
}

/**
 * Activities already typed TRANSFER_IN/TRANSFER_OUT but not yet linked to a
 * pair. ActivityDetails carries no sourceGroupId (the SDK deliberately omits
 * it), so "already paired" is determined by calling getTransferPair per leg:
 * it resolves null when the activity has no existing pair. Shared by Path A (which
 * matches these against each other) and Path B (which matches them against
 * plain DEPOSIT/WITHDRAWAL legs), so the check only runs once per scan.
 */
export async function findUnpairedTransferLegs(
  api: HostAPI,
  activities: ActivityDetails[],
  onProgress?: (progress: ScanProgress) => void,
): Promise<UnpairedTransferLegs> {
  const transferLegs = activities.filter(
    (a) => a.activityType === TRANSFER_IN || a.activityType === TRANSFER_OUT,
  );

  const unpaired: ActivityDetails[] = [];
  let checked = 0;
  await Promise.all(
    transferLegs.map(async (leg) => {
      try {
        const pair = await api.activities.getTransferPair(leg.id);
        if (!pair) unpaired.push(leg);
      } catch {
        // Rejects only when the activity no longer exists - not a candidate.
      } finally {
        checked += 1;
        onProgress?.({ stage: "checking-pairs", current: checked, total: transferLegs.length });
      }
    }),
  );

  return { legs: unpaired, ids: new Set(unpaired.map((leg) => leg.id)) };
}

/**
 * Path A: unpaired TRANSFER_IN/TRANSFER_OUT legs, matched against each other.
 * Delegates matching/scoring to the host's own findTransferMatchCandidates
 * rather than reimplementing it - the addon's job here is only to find which
 * legs are unpaired (via `unpaired`, computed once by findUnpairedTransferLegs)
 * and call linkTransfer.
 */
export async function findLinkedTransferCandidates(
  api: HostAPI,
  activities: ActivityDetails[],
  unpaired: UnpairedTransferLegs,
  settings: MatchSettings = DEFAULT_SETTINGS,
  onProgress?: (progress: ScanProgress) => void,
  dismissed: ReadonlySet<string> = new Set(),
): Promise<ProposedPair[]> {
  const byId = new Map(activities.map((a) => [a.id, a] as const));
  const unpairedIds = unpaired.ids;
  const usedIds = new Set<string>();
  const pairs: ProposedPair[] = [];

  let matched = 0;
  for (const leg of unpaired.legs) {
    matched += 1;
    onProgress?.({ stage: "matching", current: matched, total: unpaired.legs.length });

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

    // Skip candidates whose pairing was already dismissed, so a dismissed
    // top match doesn't block a viable second-best match from ever surfacing.
    const best = candidates.find(
      (c) =>
        unpairedIds.has(c.activity.id) &&
        !usedIds.has(c.activity.id) &&
        !dismissed.has(pairKey(leg.id, c.activity.id)),
    );
    if (!best) continue;

    const counterpart = byId.get(best.activity.id);
    if (!counterpart) continue;

    usedIds.add(leg.id);
    usedIds.add(counterpart.id);

    const [legOut, legIn] =
      leg.activityType === TRANSFER_OUT ? [leg, counterpart] : [counterpart, leg];

    pairs.push({
      key: pairKey(leg.id, counterpart.id),
      source: "linked-candidate",
      reclassifyOut: false,
      reclassifyIn: false,
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
