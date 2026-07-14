import type { ActivityType } from "@wealthfolio/addon-sdk";

/**
 * The SDK's root export is `export type * from './data-types'`, so
 * `ActivityType` only exists as a type at the package's public surface - the
 * runtime const object isn't re-exported. These are the canonical string
 * literals it would have held.
 */
export const WITHDRAWAL: ActivityType = "WITHDRAWAL";
export const DEPOSIT: ActivityType = "DEPOSIT";
export const TRANSFER_IN: ActivityType = "TRANSFER_IN";
export const TRANSFER_OUT: ActivityType = "TRANSFER_OUT";
export const BUY: ActivityType = "BUY";
