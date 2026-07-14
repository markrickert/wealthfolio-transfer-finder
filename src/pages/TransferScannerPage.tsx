import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { AddonContext } from "@wealthfolio/addon-sdk";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Icons,
  Input,
  Label,
  Progress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wealthfolio/ui";
import { useDismissed } from "../hooks/useDismissed";
import { useMatchSettings } from "../hooks/useMatchSettings";
import { usePrivacyMode, type PrivacyLevel } from "../hooks/usePrivacyMode";
import { TRANSFER_IN, TRANSFER_OUT } from "../lib/activityTypes";
import { createFakeAmountGenerator, createFakeNameGenerator } from "../lib/fakeData";
import { scanForTransferPairs } from "../lib/scan";
import { applyProposedPair } from "../lib/apply";
import type { ProposedPair, ScanProgress } from "../types/pair";

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

// groupKey should be the pair's key, not either leg's own activity ID - both
// legs of a real transfer represent the same movement of money, so in ultra
// mode they must show the same fake amount, not two unrelated random ones.
type ResolveDisplay = (
  activity: ProposedPair["legOut"],
  groupKey: string,
) => { name: string; amountText: string };

function useResolveDisplay(privacyLevel: PrivacyLevel): ResolveDisplay {
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

const LONG_PRESS_MS = 500;

/** Click toggles normal ("••••") privacy; press-and-hold toggles ultra
 * privacy (fake institution names + fake amounts, for screenshots). */
function PrivacyToggleButton({
  privacyLevel,
  toggleHidden,
  toggleUltra,
}: {
  privacyLevel: PrivacyLevel;
  toggleHidden: () => void;
  toggleUltra: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  function startPress() {
    longPressFiredRef.current = false;
    timerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      toggleUltra();
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleClick() {
    // A long-press still fires a trailing click on release - swallow that
    // one so it doesn't also toggle normal privacy.
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    toggleHidden();
  }

  const label =
    privacyLevel === "off"
      ? "Hide amounts (hold for ultra privacy)"
      : privacyLevel === "hidden"
        ? "Show amounts"
        : "Exit ultra privacy";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="shrink-0"
      aria-label={label}
      title={label}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => e.preventDefault()}
      onClick={handleClick}
    >
      {privacyLevel === "off" ? (
        <Icons.Eye className="h-4 w-4" />
      ) : (
        <Icons.EyeOff className={`h-4 w-4 ${privacyLevel === "ultra" ? "text-primary" : ""}`} />
      )}
    </Button>
  );
}

function formatDate(date: Date): string {
  // Same coercion as matcher.ts's timeOf(): date may arrive as an ISO string
  // rather than a real Date instance once it crosses the addon sandbox.
  return new Date(date).toLocaleDateString();
}

const SCAN_STAGE_LABEL: Record<ScanProgress["stage"], string> = {
  fetching: "Loading activities",
  "checking-pairs": "Checking existing pairings",
  matching: "Finding matches",
};

function formatScanProgress(progress: ScanProgress): string {
  return `${SCAN_STAGE_LABEL[progress.stage]}… (${progress.current}/${progress.total})`;
}

function scanProgressPercent(progress: ScanProgress): number {
  if (progress.total <= 0) return 0;
  return Math.min(100, (progress.current / progress.total) * 100);
}

const CONFIDENCE_BADGE: Record<ProposedPair["confidence"], "success" | "warning" | "outline"> = {
  high: "success",
  medium: "warning",
  low: "outline",
};

function Leg({
  activity,
  groupKey,
  resolveDisplay,
}: {
  activity: ProposedPair["legOut"];
  groupKey: string;
  resolveDisplay: ResolveDisplay;
}) {
  const { name, amountText } = resolveDisplay(activity, groupKey);
  return (
    <div className="space-y-0.5">
      <div className="font-medium">{name}</div>
      <div className="text-sm text-muted-foreground">
        {formatDate(activity.date)} · {amountText}
      </div>
      {activity.comment ? (
        <div className="text-xs text-muted-foreground italic">{activity.comment}</div>
      ) : null}
    </div>
  );
}

function LegChange({
  activity,
  newType,
  groupKey,
  resolveDisplay,
}: {
  activity: ProposedPair["legOut"];
  newType: string;
  groupKey: string;
  resolveDisplay: ResolveDisplay;
}) {
  const { name, amountText } = resolveDisplay(activity, groupKey);
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <div>
        <div className="font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">
          {formatDate(activity.date)} · {amountText}
        </div>
      </div>
      <div className="text-xs text-right whitespace-nowrap">
        <span className="text-muted-foreground line-through">{activity.activityType}</span>
        {" → "}
        <span className="font-medium">{newType}</span>
      </div>
    </div>
  );
}

function PairTable({
  pairs,
  processingKeys,
  onApprove,
  onDismiss,
  resolveDisplay,
}: {
  pairs: ProposedPair[];
  processingKeys: Set<string>;
  onApprove: (pair: ProposedPair) => void;
  onDismiss: (pair: ProposedPair) => void;
  resolveDisplay: ResolveDisplay;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Confidence</TableHead>
          <TableHead>Outflow</TableHead>
          <TableHead>Inflow</TableHead>
          <TableHead>Details</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pairs.map((pair) => {
          const busy = processingKeys.has(pair.key);
          return (
            <TableRow key={pair.key}>
              <TableCell>
                <Badge variant={CONFIDENCE_BADGE[pair.confidence]}>{pair.confidence}</Badge>
              </TableCell>
              <TableCell>
                {pair.reclassifyOut ? (
                  <LegChange
                    activity={pair.legOut}
                    newType={TRANSFER_OUT}
                    groupKey={pair.key}
                    resolveDisplay={resolveDisplay}
                  />
                ) : (
                  <Leg activity={pair.legOut} groupKey={pair.key} resolveDisplay={resolveDisplay} />
                )}
              </TableCell>
              <TableCell>
                {pair.reclassifyIn ? (
                  <LegChange
                    activity={pair.legIn}
                    newType={TRANSFER_IN}
                    groupKey={pair.key}
                    resolveDisplay={resolveDisplay}
                  />
                ) : (
                  <Leg activity={pair.legIn} groupKey={pair.key} resolveDisplay={resolveDisplay} />
                )}
              </TableCell>
              <TableCell className="max-w-xs">
                {pair.reasons.map((reason) => (
                  <div key={reason} className="text-xs text-muted-foreground">
                    {reason}
                  </div>
                ))}
                {pair.warnings.map((warning) => (
                  <div key={warning} className="text-xs text-warning">
                    {warning}
                  </div>
                ))}
              </TableCell>
              <TableCell className="text-right space-x-2 whitespace-nowrap">
                <Button size="sm" variant="ghost" onClick={() => onDismiss(pair)} disabled={busy}>
                  Dismiss
                </Button>
                <Button size="sm" onClick={() => onApprove(pair)} disabled={busy}>
                  {busy ? "Linking…" : "Approve"}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

const CONFETTI_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6"];

function ConfettiPiece({ index }: { index: number }) {
  const left = Math.random() * 100;
  const delay = Math.random() * 0.3;
  const duration = 2.6 + Math.random() * 1.6;
  // Quick launch up by --rise, then a much slower float back down past the
  // origin to --fall (like paper catching air, not just dropping), drifting
  // sideways by --drift and spinning by --spin along the way.
  const rise = -(60 + Math.random() * 200);
  const fall = 260 + Math.random() * 180;
  const drift = (Math.random() - 0.5) * 220;
  const spin = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540);
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];

  return (
    <span
      className="absolute bottom-0 block h-2.5 w-1.5 rounded-sm"
      style={
        {
          left: `${left}%`,
          backgroundColor: color,
          "--rise": `${rise}px`,
          "--fall": `${fall}px`,
          "--drift": `${drift}px`,
          "--spin": `${spin}deg`,
          animation: `wf-transfers-confetti-arc ${duration}s ${delay}s forwards`,
        } as CSSProperties
      }
    />
  );
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 200 }, (_, i) => i), []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes wf-transfers-confetti-arc {
          0% {
            transform: translate(0, 0) rotate(0deg);
            opacity: 1;
            animation-timing-function: ease-out;
          }
          20% {
            transform: translate(calc(var(--drift) * 0.3), var(--rise)) rotate(calc(var(--spin) * 0.3));
            opacity: 1;
            animation-timing-function: ease-in;
          }
          85% {
            transform: translate(calc(var(--drift) * 0.9), calc(var(--fall) * 0.85)) rotate(calc(var(--spin) * 0.85));
            opacity: 1;
          }
          100% {
            transform: translate(var(--drift), var(--fall)) rotate(var(--spin));
            opacity: 0;
          }
        }
      `}</style>
      {pieces.map((i) => (
        <ConfettiPiece key={i} index={i} />
      ))}
    </div>
  );
}

function FadeIn({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`space-y-4 transition-opacity duration-500 ${visible ? "opacity-100" : "opacity-0"}`}>
      {children}
    </div>
  );
}

export function TransferScannerPage({ ctx }: { ctx: AddonContext }) {
  const api = ctx.api;
  const { dismissed, dismiss, loaded: dismissedLoaded } = useDismissed(api);
  const { settings, setSettings } = useMatchSettings(api);
  const { privacyLevel, toggleHidden, toggleUltra } = usePrivacyMode(api);
  const resolveDisplay = useResolveDisplay(privacyLevel);

  const [pairs, setPairs] = useState<ProposedPair[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [processingKeys, setProcessingKeys] = useState<Set<string>>(new Set());
  const [hasScanned, setHasScanned] = useState(false);
  const [celebrationKey, setCelebrationKey] = useState(0);

  const linkedPairs = useMemo(() => pairs.filter((p) => p.source === "linked-candidate"), [pairs]);
  const reclassifyPairs = useMemo(() => pairs.filter((p) => p.source === "reclassify"), [pairs]);
  const showCelebration = !scanning && hasScanned && pairs.length === 0;

  // Fires a fresh confetti burst each time the empty state is newly reached,
  // whether by a scan landing on zero or by approving/dismissing the last pair.
  useEffect(() => {
    if (showCelebration) {
      setCelebrationKey((k) => k + 1);
    }
  }, [showCelebration]);

  async function handleScan() {
    if (!dismissedLoaded) return;
    setScanning(true);
    setScanProgress(null);
    try {
      const results = await scanForTransferPairs(api, settings, dismissed, (progress) =>
        setScanProgress(progress),
      );
      setPairs(results);
      setHasScanned(true);
    } catch (err) {
      api.toast.error(`Scan failed: ${String(err instanceof Error ? err.message : err)}`);
    } finally {
      setScanning(false);
      setScanProgress(null);
    }
  }

  async function approvePair(pair: ProposedPair) {
    setProcessingKeys((prev) => new Set(prev).add(pair.key));

    try {
      await applyProposedPair(api, pair);
      api.toast.success(`Linked ${pair.legOut.accountName} → ${pair.legIn.accountName}`);
      setPairs((prev) => prev.filter((p) => p.key !== pair.key));
    } catch (err) {
      api.toast.error(
        `Failed to link ${pair.legOut.accountName} → ${pair.legIn.accountName}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      setProcessingKeys((prev) => {
        const next = new Set(prev);
        next.delete(pair.key);
        return next;
      });
    }
  }

  function handleApprove(pair: ProposedPair) {
    void approvePair(pair);
  }

  function handleDismiss(pair: ProposedPair) {
    dismiss(pair.key);
    setPairs((prev) => prev.filter((p) => p.key !== pair.key));
  }

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Transfer Pairing</CardTitle>
            <CardDescription>
              Scan transactions for internal transfers that aren&apos;t linked yet - including plain
              deposits/withdrawals that were never classified as transfers - and review each match
              before linking.
            </CardDescription>
          </div>
          <PrivacyToggleButton
            privacyLevel={privacyLevel}
            toggleHidden={toggleHidden}
            toggleUltra={toggleUltra}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="window-days">Match window (days)</Label>
              <Input
                id="window-days"
                type="number"
                min={0}
                className="w-28"
                value={settings.windowDays}
                disabled={scanning}
                onChange={(e) =>
                  setSettings({ ...settings, windowDays: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="amount-tolerance">Amount tolerance</Label>
              <Input
                id="amount-tolerance"
                type="number"
                min={0}
                step="0.01"
                className="w-28"
                value={settings.amountTolerance}
                disabled={scanning}
                onChange={(e) =>
                  setSettings({ ...settings, amountTolerance: Number(e.target.value) || 0 })
                }
              />
            </div>
            <Button onClick={() => void handleScan()} disabled={scanning || !dismissedLoaded}>
              {dismissedLoaded ? "Scan for Transfer Pairs" : "Loading preferences…"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {scanning ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center justify-center gap-3 text-center">
            {scanProgress ? (
              <div className="w-full max-w-xs space-y-1">
                <Progress value={scanProgressPercent(scanProgress)} />
                <div className="text-xs text-muted-foreground">{formatScanProgress(scanProgress)}</div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : showCelebration ? (
        <FadeIn>
          <Card className="relative overflow-hidden">
            <Confetti key={celebrationKey} />
            <CardContent className="py-16 flex flex-col items-center justify-center gap-2 text-center">
              <Icons.CheckCircle className="h-10 w-10 text-success" />
              <h2 className="text-xl font-semibold">All caught up!</h2>
              <p className="text-sm text-muted-foreground">No unmarked transfer pairs left to review.</p>
            </CardContent>
          </Card>
        </FadeIn>
      ) : (
        <FadeIn>
          {linkedPairs.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Unlinked Transfers</CardTitle>
                <CardDescription>Already typed as transfers, found pairs:</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <PairTable
                  pairs={linkedPairs}
                  processingKeys={processingKeys}
                  onApprove={handleApprove}
                  onDismiss={handleDismiss}
                  resolveDisplay={resolveDisplay}
                />
              </CardContent>
            </Card>
          ) : null}

          {reclassifyPairs.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Deposits &amp; Withdrawals to Reclassify</CardTitle>
                <CardDescription className="flex items-start gap-2">
                  <Icons.AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
                  <span>
                    Approving will reclassify the untyped leg(s) to TRANSFER_OUT/TRANSFER_IN before
                    linking. Unlinking later removes the pairing but does
                    <strong> not</strong> revert the type change.
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <PairTable
                  pairs={reclassifyPairs}
                  processingKeys={processingKeys}
                  onApprove={handleApprove}
                  onDismiss={handleDismiss}
                  resolveDisplay={resolveDisplay}
                />
              </CardContent>
            </Card>
          ) : null}
        </FadeIn>
      )}
    </div>
  );
}
