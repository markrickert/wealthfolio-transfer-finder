import { describe, expect, it } from 'vitest';
import type { ActivityType, ActivityDetails } from '@wealthfolio/addon-sdk';
import { BUY, DEPOSIT, WITHDRAWAL } from './activityTypes';
import { matchUnmarkedPairs } from './matcher';

let counter = 0;

function activity(params: {
  type: ActivityType;
  accountId: string;
  amount: number;
  day: number;
  currency?: string;
  id?: string;
}): ActivityDetails {
  const id = params.id ?? `act-${counter++}`;
  const date = new Date(Date.UTC(2026, 0, 1 + params.day));
  const currency = params.currency ?? 'USD';
  return {
    id,
    activityType: params.type,
    subtype: null,
    date,
    quantity: null,
    unitPrice: null,
    amount: String(params.amount),
    fee: null,
    tax: null,
    currency,
    needsReview: false,
    fxRate: null,
    createdAt: date,
    assetId: '$CASH-USD',
    updatedAt: date,
    accountId: params.accountId,
    accountName: params.accountId,
    accountCurrency: currency,
    assetSymbol: '$CASH-USD',
  };
}

describe('matchUnmarkedPairs', () => {
  it('matches an exact same-day withdrawal/deposit pair across accounts', () => {
    const w = activity({ type: WITHDRAWAL, accountId: 'checking', amount: 500, day: 0 });
    const d = activity({ type: DEPOSIT, accountId: 'savings', amount: 500, day: 0 });

    const pairs = matchUnmarkedPairs([w, d]);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].confidence).toBe('high');
    expect(pairs[0].legOut.id).toBe(w.id);
    expect(pairs[0].legIn.id).toBe(d.id);
  });

  it('does not match legs within the same account', () => {
    const w = activity({ type: WITHDRAWAL, accountId: 'checking', amount: 500, day: 0 });
    const d = activity({ type: DEPOSIT, accountId: 'checking', amount: 500, day: 0 });

    expect(matchUnmarkedPairs([w, d])).toHaveLength(0);
  });

  it('rejects pairs beyond the date window', () => {
    const w = activity({ type: WITHDRAWAL, accountId: 'a', amount: 500, day: 0 });
    const d = activity({ type: DEPOSIT, accountId: 'b', amount: 500, day: 10 });

    expect(matchUnmarkedPairs([w, d], { windowDays: 5, amountTolerance: 1 })).toHaveLength(0);
  });

  it('rejects pairs beyond the amount tolerance', () => {
    const w = activity({ type: WITHDRAWAL, accountId: 'a', amount: 500, day: 0 });
    const d = activity({ type: DEPOSIT, accountId: 'b', amount: 490, day: 0 });

    expect(matchUnmarkedPairs([w, d], { windowDays: 5, amountTolerance: 1 })).toHaveLength(0);
  });

  it('matches a fee-reduced amount within tolerance at low confidence', () => {
    const w = activity({ type: WITHDRAWAL, accountId: 'a', amount: 500, day: 0 });
    const d = activity({ type: DEPOSIT, accountId: 'b', amount: 499, day: 0 });

    const pairs = matchUnmarkedPairs([w, d], { windowDays: 5, amountTolerance: 1 });

    expect(pairs).toHaveLength(1);
    expect(pairs[0].confidence).toBe('low');
    expect(pairs[0].warnings[0]).toMatch(/differs by/);
  });

  it('ignores currency mismatches', () => {
    const w = activity({ type: WITHDRAWAL, accountId: 'a', amount: 500, day: 0, currency: 'USD' });
    const d = activity({ type: DEPOSIT, accountId: 'b', amount: 500, day: 0, currency: 'CAD' });

    expect(matchUnmarkedPairs([w, d])).toHaveLength(0);
  });

  it('ignores activity types other than WITHDRAWAL/DEPOSIT', () => {
    const buy = activity({ type: BUY, accountId: 'a', amount: 500, day: 0 });
    const d = activity({ type: DEPOSIT, accountId: 'b', amount: 500, day: 0 });

    expect(matchUnmarkedPairs([buy, d])).toHaveLength(0);
  });

  it('does not cross-wire recurring same-amount transfers to the wrong counterpart', () => {
    // Fed out of order, and both cross-pairs are technically within the window,
    // so only nearest-date greedy assignment (not array/insertion order) gets
    // this right.
    const out1 = activity({
      type: WITHDRAWAL,
      accountId: 'checking',
      amount: 500,
      day: 10,
      id: 'out-day10',
    });
    const out2 = activity({
      type: WITHDRAWAL,
      accountId: 'checking',
      amount: 500,
      day: 0,
      id: 'out-day0',
    });
    const in1 = activity({ type: DEPOSIT, accountId: 'savings', amount: 500, day: 1, id: 'in-day1' });
    const in2 = activity({ type: DEPOSIT, accountId: 'savings', amount: 500, day: 11, id: 'in-day11' });

    const pairs = matchUnmarkedPairs([out1, out2, in1, in2], { windowDays: 15, amountTolerance: 1 });

    expect(pairs).toHaveLength(2);
    const byOutId = new Map(pairs.map((p) => [p.legOut.id, p.legIn.id]));
    expect(byOutId.get('out-day0')).toBe('in-day1');
    expect(byOutId.get('out-day10')).toBe('in-day11');
  });
});
