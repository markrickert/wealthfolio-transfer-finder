import type { ProposedPair } from "../types/pair";

export type ResolveDisplay = (
  activity: ProposedPair["legOut"],
  groupKey: string,
) => { name: string; amountText: string };
