const FAKE_INSTITUTIONS = [
  "Meridian Bank",
  "Northbridge Credit Union",
  "Silverline Investments",
  "Harbor Point Financial",
  "Cobalt Trust Co.",
  "Union Ridge Bank",
  "Palisade Capital",
  "Amber Creek Federal",
  "Wayfarer Financial",
  "Granite Hollow Bank",
  "Lighthouse Credit Union",
  "Blue Anchor Investments",
  "Redstone National Bank",
  "Foxglove Wealth Partners",
  "Cascade Point Bank",
];

/**
 * Returns a function that maps a real account ID to a stable fake
 * institution name - the same account always gets the same fake name for
 * as long as the returned function is kept around, but each call to this
 * factory produces a fresh random assignment.
 */
export function createFakeNameGenerator(): (accountId: string) => string {
  const assigned = new Map<string, string>();
  const shuffled = [...FAKE_INSTITUTIONS].sort(() => Math.random() - 0.5);
  let next = 0;

  return (accountId: string) => {
    const cached = assigned.get(accountId);
    if (cached) return cached;

    const base = shuffled[next % shuffled.length];
    const cycle = Math.floor(next / shuffled.length) + 1;
    const fake = cycle > 1 ? `${base} ${cycle}` : base;
    next += 1;
    assigned.set(accountId, fake);
    return fake;
  };
}

/**
 * Returns a function that maps a cache key to a stable fake dollar amount
 * (same shape/precision as a real transaction), for screenshot purposes.
 * Key this by the PAIR (e.g. pair.key), not by either leg's own activity ID -
 * both legs of a real transfer represent the same movement of money, so they
 * should show the same fake amount too, not two unrelated random numbers.
 */
export function createFakeAmountGenerator(): (cacheKey: string) => number {
  const assigned = new Map<string, number>();

  return (cacheKey: string) => {
    const cached = assigned.get(cacheKey);
    if (cached !== undefined) return cached;

    const fake = Math.round((10 + Math.random() * 9990) * 100) / 100;
    assigned.set(cacheKey, fake);
    return fake;
  };
}
