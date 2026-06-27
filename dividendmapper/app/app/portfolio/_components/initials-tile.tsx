// Deterministic placeholder tile rendered when a logo.dev request 404s.
// Background colour derives from a hash of the ticker so the same holding
// always gets the same colour across renders.

export function hashHue(ticker: string): number {
  // FNV-1a 32-bit, then mod 360.
  let h = 0x811c9dc5;
  for (let i = 0; i < ticker.length; i++) {
    h ^= ticker.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 360;
}

function initials(ticker: string): string {
  const alnum = ticker.replace(/[^A-Za-z0-9]/g, "");
  if (alnum.length === 0) return "?";
  return alnum.slice(0, 2).toUpperCase();
}

interface Props {
  ticker: string;
  size?: number;
}

export function InitialsTile({ ticker, size = 32 }: Props) {
  const hue = hashHue(ticker);
  return (
    <div
      role="img"
      aria-label={`${ticker} placeholder logo`}
      style={{
        width: size,
        height: size,
        backgroundColor: `hsl(${hue} 35% 28%)`,
        color: `hsl(${hue} 55% 88%)`,
      }}
      className="grid place-items-center rounded-md border border-border/40 font-display text-[11px] font-semibold"
    >
      {initials(ticker)}
    </div>
  );
}
