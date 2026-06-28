"use client";

// Sticky 3y / 5y / 10y toggle for the Inspect ticker page. Stays a presentational
// client component for now; the real chart re-render lands Day 6 when the
// parent will own a windowYears state and pass setter down to here.

type Props = {
  value: 3 | 5 | 10;
  onChange: (v: 3 | 5 | 10) => void;
  available10y: boolean;
};

export function InspectWindowSelector({ value, onChange, available10y }: Props) {
  const opts: Array<3 | 5 | 10> = available10y ? [3, 5, 10] : [3, 5];
  return (
    <div className="sticky top-2 z-10 inline-flex rounded-full border border-border bg-background/95 p-1 shadow-sm backdrop-blur">
      {opts.map((y) => (
        <button
          key={y}
          onClick={() => onChange(y)}
          className={`rounded-full px-4 py-1 text-sm font-medium transition ${
            value === y
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={value === y}
          type="button"
        >
          {y}y
        </button>
      ))}
    </div>
  );
}
