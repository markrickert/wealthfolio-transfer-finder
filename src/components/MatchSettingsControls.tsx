import { Button, Input, Label } from "@wealthfolio/ui";
import type { MatchSettings } from "../types/pair";

export function MatchSettingsControls({
  settings,
  scanning,
  dismissedLoaded,
  onChange,
  onScan,
}: {
  settings: MatchSettings;
  scanning: boolean;
  dismissedLoaded: boolean;
  onChange: (next: MatchSettings) => void;
  onScan: () => void;
}) {
  return (
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
          onChange={(e) => onChange({ ...settings, windowDays: Number(e.target.value) || 0 })}
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
          onChange={(e) => onChange({ ...settings, amountTolerance: Number(e.target.value) || 0 })}
        />
      </div>
      <Button onClick={onScan} disabled={scanning || !dismissedLoaded}>
        {dismissedLoaded ? "Scan for Transfer Pairs" : "Loading preferences..."}
      </Button>
    </div>
  );
}
