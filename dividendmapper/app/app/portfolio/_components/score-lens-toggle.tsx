"use client";

import { useRouter } from "next/navigation";

// Opt-in score lens. Navigates between ?lens=1 and the base Manager URL; the
// force-dynamic page re-renders with re-aggregated buy scores server-side.
export function ScoreLensToggle({ on }: { on: boolean }) {
  const router = useRouter();
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) =>
          router.replace(
            e.target.checked ? "/app/portfolio/scoring?lens=1" : "/app/portfolio/scoring",
          )
        }
        className="h-4 w-4 rounded border-input"
      />
      View Quality through my goals
    </label>
  );
}
