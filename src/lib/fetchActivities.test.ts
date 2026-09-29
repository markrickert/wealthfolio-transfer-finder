import { describe, expect, it } from "vitest";
import type { ActivityDetails, HostAPI } from "@wealthfolio/addon-sdk";
import { fetchAllActivities } from "./fetchActivities";

/** Mimics the host's search(): 0-based pages, offset = page * pageSize. */
function apiWith(rows: ActivityDetails[]): { api: HostAPI; pages: number[] } {
  const pages: number[] = [];
  const api = {
    activities: {
      search: async (page: number, pageSize: number) => {
        pages.push(page);
        return {
          data: rows.slice(page * pageSize, (page + 1) * pageSize),
          meta: { totalRowCount: rows.length },
        };
      },
    },
  } as unknown as HostAPI;
  return { api, pages };
}

function rows(count: number): ActivityDetails[] {
  return Array.from({ length: count }, (_, i) => ({ id: `a${i}` }) as ActivityDetails);
}

describe("fetchAllActivities", () => {
  it("fetches every row across multiple 0-based pages, starting at page 0", async () => {
    const all = rows(1200);
    const { api, pages } = apiWith(all);

    const result = await fetchAllActivities(api);

    expect(pages).toEqual([0, 1, 2]);
    expect(result.map((a) => a.id)).toEqual(all.map((a) => a.id));
  });

  it("includes the first page when everything fits on it", async () => {
    const all = rows(3);
    const { api, pages } = apiWith(all);

    const result = await fetchAllActivities(api);

    expect(pages).toEqual([0]);
    expect(result).toHaveLength(3);
  });
});
