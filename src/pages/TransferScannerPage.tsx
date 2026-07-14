import { useEffect, useMemo, useState } from "react";
import type { AddonContext } from "@wealthfolio/addon-sdk";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Icons,
  Progress,
} from "@wealthfolio/ui";
import { Confetti } from "../components/Confetti";
import { FadeIn } from "../components/FadeIn";
import { MatchSettingsControls } from "../components/MatchSettingsControls";
import { PairTable } from "../components/PairTable";
import { PrivacyToggleButton } from "../components/PrivacyToggleButton";
import { useDismissed } from "../hooks/useDismissed";
import { useMatchSettings } from "../hooks/useMatchSettings";
import { usePrivacyMode } from "../hooks/usePrivacyMode";
import { useResolveDisplay } from "../hooks/useResolveDisplay";
import { applyProposedPair } from "../lib/apply";
import { scanForTransferPairs } from "../lib/scan";
import { formatScanProgress, scanProgressPercent } from "../lib/transferScannerFormat";
import type { ProposedPair, ScanProgress } from "../types/pair";

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
      api.toast.success(`Linked ${pair.legOut.accountName} -> ${pair.legIn.accountName}`);
      setPairs((prev) => prev.filter((p) => p.key !== pair.key));
    } catch (err) {
      api.toast.error(
        `Failed to link ${pair.legOut.accountName} -> ${pair.legIn.accountName}: ${
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
          <MatchSettingsControls
            settings={settings}
            scanning={scanning}
            dismissedLoaded={dismissedLoaded}
            onChange={setSettings}
            onScan={() => void handleScan()}
          />
        </CardContent>
      </Card>

      {scanning ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center justify-center gap-3 text-center">
            {scanProgress ? (
              <div className="w-full max-w-xs space-y-1">
                <Progress value={scanProgressPercent(scanProgress)} />
                <div className="text-xs text-muted-foreground">
                  {formatScanProgress(scanProgress)}
                </div>
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
              <p className="text-sm text-muted-foreground">
                No unmarked transfer pairs left to review.
              </p>
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
