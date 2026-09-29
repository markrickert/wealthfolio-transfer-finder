import { describe, expect, it, vi } from "vitest";
import type { ActivityDetails, ActivityUpdate, HostAPI } from "@wealthfolio/addon-sdk";
import type { ProposedPair } from "../types/pair";
import { applyProposedPair } from "./apply";

vi.mock("@wealthfolio/addon-sdk", () => ({ QueryKeys: { ACTIVITIES: "activities" } }));

function leg(id: string, assetId: string): ActivityDetails {
  return { id, accountId: `acct-${id}`, assetId, currency: "USD" } as ActivityDetails;
}

function apiRecordingUpdates(): { api: HostAPI; updates: ActivityUpdate[] } {
  const updates: ActivityUpdate[] = [];
  const api = {
    activities: {
      update: async (activity: ActivityUpdate) => {
        updates.push(activity);
      },
      linkTransfer: async () => undefined,
    },
    query: { invalidateQueries: () => undefined },
  } as unknown as HostAPI;
  return { api, updates };
}

function reclassifyPair(legOut: ActivityDetails, legIn: ActivityDetails): ProposedPair {
  return {
    key: `${legOut.id}:${legIn.id}`,
    source: "reclassify",
    reclassifyOut: true,
    reclassifyIn: true,
    legOut,
    legIn,
    confidence: "high",
    score: 100,
    reasons: [],
    warnings: [],
  };
}

describe("applyProposedPair", () => {
  it("omits asset for cash legs, whose assetId comes back as an empty string", async () => {
    const { api, updates } = apiRecordingUpdates();

    await applyProposedPair(api, reclassifyPair(leg("out", ""), leg("in", "")));

    expect(updates).toHaveLength(2);
    for (const update of updates) expect(update.asset).toBeUndefined();
  });

  it("keeps the asset id for legs that have one", async () => {
    const { api, updates } = apiRecordingUpdates();

    await applyProposedPair(api, reclassifyPair(leg("out", "CASH:USD"), leg("in", "")));

    expect(updates[0].asset).toEqual({ id: "CASH:USD" });
    expect(updates[1].asset).toBeUndefined();
  });
});
