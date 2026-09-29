import type { HostAPI } from "@wealthfolio/addon-sdk";
import { fetchAllActivities } from "./fetchActivities";
import {
  findLinkedTransferCandidates,
  findUnpairedTransferLegs,
  matchUnmarkedPairs,
} from "./matcher";
import type { MatchSettings, ProposedPair, ScanProgress } from "../types/pair";
import { DEFAULT_SETTINGS } from "../types/pair";

export type { ScanProgress };

/** Merges pair lists (Path A + Path B can't both propose the same key by
 * construction, but this guards against it anyway), drops anything already
 * dismissed, first match wins. */
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
    onProgress?.({ stage: "fetching", current: loaded, total }),
  );

  const unpaired = await findUnpairedTransferLegs(api, activities, onProgress);

  // findLinkedTransferCandidates (Path A: unpaired transfer legs against each
  // other) and matchUnmarkedPairs (Path B: plain deposit/withdrawal legs,
  // including mixed pairs against an unpaired transfer leg) both consume the
  // same unpaired-legs result computed once above.
  const [linkedCandidates, unmarkedPairs] = await Promise.all([
    findLinkedTransferCandidates(api, activities, unpaired, settings, onProgress, dismissed),
    Promise.resolve(matchUnmarkedPairs(activities, settings, dismissed, unpaired.ids)),
  ]);

  return combineProposedPairs([linkedCandidates, unmarkedPairs], dismissed);
}
