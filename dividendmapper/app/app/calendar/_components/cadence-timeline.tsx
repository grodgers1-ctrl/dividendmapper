"use client";

export interface CadenceMarker {
  id: string;
  dayOfMonth: number;
}

export interface CadenceTimelineProps {
  monthYm: string;
  anchor: "ex" | "pay";
  markers: ReadonlyArray<CadenceMarker>;
  today?: string;
  onHoverMarker?: (id: string | null) => void;
}

const DAYS_IN_MONTH = 31;

function isPulseDay(day: number, today: string | undefined, monthYm: string): boolean {
  if (!today) return false;
  if (today.slice(0, 7) !== monthYm) return false;
  const todayDay = Number(today.slice(8, 10));
  return Math.abs(todayDay - day) <= 3;
}

export function CadenceTimeline({
  monthYm,
  anchor,
  markers,
  today,
  onHoverMarker,
}: CadenceTimelineProps) {
  return (
    <div className="mt-3" aria-label={`Cadence timeline for ${monthYm} (${anchor}-date anchor)`}>
      <div className="relative h-6 border-b border-[var(--border-subtle)]">
        {markers.map((m) => {
          const leftPct = ((m.dayOfMonth - 1) / (DAYS_IN_MONTH - 1)) * 100;
          const pulse = isPulseDay(m.dayOfMonth, today, monthYm);
          return (
            <span
              key={m.id}
              data-testid="cadence-marker"
              data-day={m.dayOfMonth}
              data-pulse={pulse ? "true" : "false"}
              onMouseEnter={() => onHoverMarker?.(m.id)}
              onMouseLeave={() => onHoverMarker?.(null)}
              className={`absolute top-1 h-3 w-3 -translate-x-1/2 rounded-full bg-[var(--brand)] ${
                pulse ? "animate-pulse" : ""
              }`}
              style={{ left: `${leftPct}%` }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-[var(--text-muted)]">
        <span>1</span>
        <span>{DAYS_IN_MONTH}</span>
      </div>
    </div>
  );
}
