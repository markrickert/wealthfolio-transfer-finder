import {
  QueryKeys,
  type ActivityDetails,
  type ActivityUpdate,
  type HostAPI,
} from "@wealthfolio/addon-sdk";
import { TRANSFER_IN, TRANSFER_OUT } from "./activityTypes";
import type { ProposedPair } from "../types/pair";

function toActivityUpdate(activity: ActivityDetails, activityType: string): ActivityUpdate {
  return {
    id: activity.id,
    accountId: activity.accountId,
    activityType,
    subtype: activity.subtype ?? null,
    activityDate: activity.date,
    asset: { id: activity.assetId },
    quantity: activity.quantity,
    unitPrice: activity.unitPrice,
    amount: activity.amount,
    currency: activity.currency,
    fee: activity.fee,
    tax: activity.tax ?? null,
    comment: activity.comment ?? null,
    fxRate: activity.fxRate,
    metadata: activity.metadata,
  };
}

/**
 * Applies one proposed pair: retypes whichever leg(s) need it to
 * TRANSFER_OUT/TRANSFER_IN first (this is NOT undone by unlinkTransfer - the
 * type change persists even after unlinking). A mixed pair only reclassifies
 * the one leg that isn't already a transfer type. Then links the pair.
 */
export async function applyProposedPair(api: HostAPI, pair: ProposedPair): Promise<void> {
  if (pair.reclassifyOut) {
    await api.activities.update(toActivityUpdate(pair.legOut, TRANSFER_OUT));
  }
  if (pair.reclassifyIn) {
    await api.activities.update(toActivityUpdate(pair.legIn, TRANSFER_IN));
  }

  await api.activities.linkTransfer(pair.legOut.id, pair.legIn.id);
  api.query.invalidateQueries(QueryKeys.ACTIVITIES);
}
