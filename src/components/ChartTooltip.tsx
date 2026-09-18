"use client";

interface TooltipRow {
  label: string;
  value: string;
  color: string;
}

export interface ChartTooltipState {
  x: number;
  y: number;
  time: string;
  rows: TooltipRow[];
}

interface ChartTooltipProps {
  state: ChartTooltipState | null;
}

export function ChartTooltip({ state }: ChartTooltipProps) {
  if (!state || state.rows.length === 0) return null;

  return (
    <div
      className="chart-tooltip pointer-events-none absolute z-20 max-w-xs"
      style={{
        left: Math.min(state.x + 12, typeof window !== "undefined" ? window.innerWidth - 280 : state.x + 12),
        top: Math.max(state.y - 8, 8),
        transform: "translateY(-100%)",
      }}
    >
      <p className="chart-tooltip-time">{state.time}</p>
      <ul className="mt-2 space-y-1">
        {state.rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-2 text-[var(--muted)]">
              <span className="h-1.5 w-3 rounded-full" style={{ background: row.color }} />
              {row.label}
            </span>
            <span className="font-mono font-semibold tabular-nums">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
