import type { ActivityDetails, HostAPI } from '@wealthfolio/addon-sdk';

const PAGE_SIZE = 500;

/**
 * search() with an empty filter/keyword returns every activity across every
 * account, so paginate through it rather than calling per-account getAll().
 */
export async function fetchAllActivities(
  api: HostAPI,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ActivityDetails[]> {
  const all: ActivityDetails[] = [];
  let page = 1;

  while (true) {
    const response = await api.activities.search(page, PAGE_SIZE, {}, '', undefined);
    all.push(...response.data);
    onProgress?.(all.length, response.meta.totalRowCount);

    if (response.data.length < PAGE_SIZE || all.length >= response.meta.totalRowCount) {
      break;
    }
    page += 1;
  }

  return all;
}
