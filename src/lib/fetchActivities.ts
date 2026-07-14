import type { ActivityDetails, HostAPI } from '@wealthfolio/addon-sdk';
import { DEPOSIT, TRANSFER_IN, TRANSFER_OUT, WITHDRAWAL } from './activityTypes';

const PAGE_SIZE = 500;

// The only types this addon's matching logic ever looks at - filtering
// server-side means trade/dividend/fee/etc. activity (usually the vast
// majority of a portfolio's history) never gets fetched or paginated at all.
const RELEVANT_ACTIVITY_TYPES = [DEPOSIT, WITHDRAWAL, TRANSFER_IN, TRANSFER_OUT];

/**
 * search() with an empty keyword returns every matching activity across every
 * account, so paginate through it rather than calling per-account getAll().
 */
export async function fetchAllActivities(
  api: HostAPI,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ActivityDetails[]> {
  const all: ActivityDetails[] = [];
  let page = 1;

  while (true) {
    const response = await api.activities.search(
      page,
      PAGE_SIZE,
      { activityTypes: RELEVANT_ACTIVITY_TYPES },
      '',
      undefined,
    );
    all.push(...response.data);
    onProgress?.(all.length, response.meta.totalRowCount);

    if (response.data.length < PAGE_SIZE || all.length >= response.meta.totalRowCount) {
      break;
    }
    page += 1;
  }

  return all;
}
