import { useMemo } from "react";
import { createFakeAmountGenerator, createFakeNameGenerator } from "../lib/fakeData";
import type { PrivacyLevel } from "./usePrivacyMode";
import { formatCurrency } from "../lib/transferScannerFormat";
import type { ResolveDisplay } from "../lib/transferScannerTypes";

export function useResolveDisplay(privacyLevel: PrivacyLevel): ResolveDisplay {
  return useMemo(() => {
    const fakeName = createFakeNameGenerator();
    const fakeAmount = createFakeAmountGenerator();

    return (activity, groupKey) => {
      if (privacyLevel === "ultra") {
        return {
          name: fakeName(activity.accountId),
          amountText: formatCurrency(fakeAmount(groupKey), activity.currency),
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
