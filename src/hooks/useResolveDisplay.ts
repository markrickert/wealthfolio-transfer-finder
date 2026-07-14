import { useMemo } from "react";
import { createFakeAmountGenerator, createFakeNameGenerator } from "../lib/fakeData";
import type { PrivacyLevel } from "./usePrivacyMode";
import { formatCurrency } from "../lib/transferScannerFormat";
import type { ResolveDisplay } from "../lib/transferScannerTypes";

export function useResolveDisplay(privacyLevel: PrivacyLevel): ResolveDisplay {
  return useMemo(() => {
    const fakeName = createFakeNameGenerator();
    const fakeAmount = createFakeAmountGenerator();
    const groupAnchorMagnitude = new Map<string, number>();

    return (activity, groupKey) => {
      if (privacyLevel === "ultra") {
        const rawAmount = Number(activity.amount ?? 0);
        const magnitude = Math.abs(rawAmount);
        const anchorMagnitude = groupAnchorMagnitude.get(groupKey) ?? magnitude;
        if (!groupAnchorMagnitude.has(groupKey)) {
          groupAnchorMagnitude.set(groupKey, anchorMagnitude);
        }

        // Keep the real magnitude delta between legs so warning text like
        // "Amount differs by X" still matches what is shown in ultra mode.
        const baseMagnitude = fakeAmount(groupKey);
        const disguisedMagnitude = Math.max(0.01, baseMagnitude + (magnitude - anchorMagnitude));
        const disguisedAmount = rawAmount < 0 ? -disguisedMagnitude : disguisedMagnitude;

        return {
          name: fakeName(activity.accountId),
          amountText: formatCurrency(disguisedAmount, activity.currency),
        };
      }
      if (privacyLevel === "hidden") {
        return { name: activity.accountName, amountText: "••••" };
      }
      return {
        name: activity.accountName,
        amountText: formatCurrency(Number(activity.amount ?? 0), activity.currency),
      };
    };
    // A fresh privacyLevel value (e.g. re-entering 'ultra') gets brand new fake
    // name/amount generators, so each activation shows a different disguise.
  }, [privacyLevel]);
}
