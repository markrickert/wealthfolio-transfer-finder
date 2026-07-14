import { useMemo, type CSSProperties } from "react";

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

export function Confetti() {
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
