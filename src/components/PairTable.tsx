import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wealthfolio/ui";
import type { PrivacyLevel } from "../hooks/usePrivacyMode";
import { TRANSFER_IN, TRANSFER_OUT } from "../lib/activityTypes";
import type { ProposedPair } from "../types/pair";
import { CONFIDENCE_BADGE, formatDate } from "../lib/transferScannerFormat";
import type { ResolveDisplay } from "../lib/transferScannerTypes";

function Leg({
  activity,
  groupKey,
  privacyLevel,
  resolveDisplay,
}: {
  activity: ProposedPair["legOut"];
  groupKey: string;
  privacyLevel: PrivacyLevel;
  resolveDisplay: ResolveDisplay;
}) {
  const { name, amountText } = resolveDisplay(activity, groupKey);
  return (
    <div className="space-y-0.5">
      <div className="font-medium">{name}</div>
      <div className="text-sm text-muted-foreground">
        {formatDate(activity.date)} · {amountText}
      </div>
      {privacyLevel !== "ultra" && activity.comment ? (
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
    <div className="space-y-0.5 text-sm">
      <div className="font-medium">{name}</div>
      <div className="text-xs text-muted-foreground">
        {formatDate(activity.date)} · {amountText}
      </div>
      <div className="text-xs text-muted-foreground">
        <span className="line-through">{activity.activityType}</span>
        {" -> "}
        <span className="font-medium text-foreground">{newType}</span>
      </div>
    </div>
  );
}

export function PairTable({
  pairs,
  processingKeys,
  onApprove,
  onDismiss,
  privacyLevel,
  resolveDisplay,
}: {
  pairs: ProposedPair[];
  processingKeys: Set<string>;
  onApprove: (pair: ProposedPair) => void;
  onDismiss: (pair: ProposedPair) => void;
  privacyLevel: PrivacyLevel;
  resolveDisplay: ResolveDisplay;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Confidence</TableHead>
          <TableHead className="w-64">Outflow</TableHead>
          <TableHead className="w-64">Inflow</TableHead>
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
                  <Leg
                    activity={pair.legOut}
                    groupKey={pair.key}
                    privacyLevel={privacyLevel}
                    resolveDisplay={resolveDisplay}
                  />
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
                  <Leg
                    activity={pair.legIn}
                    groupKey={pair.key}
                    privacyLevel={privacyLevel}
                    resolveDisplay={resolveDisplay}
                  />
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
                  {busy ? "Linking..." : "Approve"}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
