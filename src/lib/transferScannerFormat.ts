import type { ProposedPair, ScanProgress } from "../types/pair";

export function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function formatDate(date: Date): string {
  // Same coercion as matcher.ts's timeOf(): date may arrive as an ISO string
  // rather than a real Date instance once it crosses the addon sandbox.
  return new Date(date).toLocaleDateString();
}

const SCAN_STAGE_LABEL: Record<ScanProgress["stage"], string> = {
  fetching: "Loading activities",
  "checking-pairs": "Checking existing pairings",
  matching: "Finding potential matches",
};

export function formatScanProgress(progress: ScanProgress): string {
  return `${SCAN_STAGE_LABEL[progress.stage]}... (${progress.current}/${progress.total})`;
}

export function scanProgressPercent(progress: ScanProgress): number {
  if (progress.total <= 0) return 0;
  return Math.min(100, (progress.current / progress.total) * 100);
}

export const CONFIDENCE_BADGE: Record<
  ProposedPair["confidence"],
  "success" | "warning" | "outline"
> = {
  high: "success",
  medium: "warning",
  low: "outline",
};
