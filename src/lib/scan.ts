import type { HostAPI } from '@wealthfolio/addon-sdk';
import { fetchAllActivities } from './fetchActivities';
import { findLinkedTransferCandidates, matchUnmarkedPairs } from './matcher';
import type { MatchSettings, ProposedPair, ScanProgress } from '../types/pair';
import { DEFAULT_SETTINGS } from '../types/pair';

export type { ScanProgress };

/** Merges pair lists (Path A + Path B are disjoint by activity type, but this
 * guards against it anyway), drops anything already dismissed, first match wins. */
export function combineProposedPairs(
  pairLists: ProposedPair[][],
  dismissed: ReadonlySet<string> = new Set(),
): ProposedPair[] {
  const seen = new Set<string>();
  const combined: ProposedPair[] = [];
  for (const pair of pairLists.flat()) {
    if (seen.has(pair.key) || dismissed.has(pair.key)) continue;
    seen.add(pair.key);
    combined.push(pair);
  }
  return combined;
}

export async function scanForTransferPairs(
  api: HostAPI,
  settings: MatchSettings = DEFAULT_SETTINGS,
  dismissed: ReadonlySet<string> = new Set(),
  onProgress?: (progress: ScanProgress) => void,
): Promise<ProposedPair[]> {
  const activities = await fetchAllActivities(api, (loaded, total) =>
    onProgress?.({ stage: 'fetching', current: loaded, total }),
  );

  // findLinkedTransferCandidates reports its own cumulative progress starting
  // at 0 - offset it by the activities already fetched so the whole scan is
  // one continuous current/total range instead of resetting per phase.
  const fetchedCount = activities.length;

  const [linkedCandidates, unmarkedPairs] = await Promise.all([
    findLinkedTransferCandidates(api, activities, settings, (progress) =>
      onProgress?.({
        stage: progress.stage,
        current: fetchedCount + progress.current,
        total: fetchedCount + progress.total,
      }),
    ),
    Promise.resolve(matchUnmarkedPairs(activities, settings)),
  ]);

  return combineProposedPairs([linkedCandidates, unmarkedPairs], dismissed);
}
