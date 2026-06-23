// Single source of truth for rendering Sector enum values in the UI. The Sector
// enum uses snake_case (matches the equity_scores.sector column); the UI uses
// Title Case. The two pass-through labels — Other, Unclassified, Smaller
// Sectors — are not enum values but appear as ad-hoc bucket names from
// rollupSectors() and must render verbatim.

const SPECIAL = new Set(["Other", "Unclassified", "Smaller Sectors"]);

export function formatSector(raw: string | null | undefined): string {
  if (raw == null) return "Unclassified";
  const trimmed = raw.trim();
  if (trimmed === "") return "Unclassified";
  if (SPECIAL.has(trimmed)) return trimmed;
  return trimmed
    .split(/[_\s]+/)
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
