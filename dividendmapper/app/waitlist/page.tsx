import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Waitlist",
  description:
    "Be the first to know when DividendMapper opens up. Free tools at launch, Pro features rolling out through Phase 2.",
  alternates: { canonical: "/waitlist" },
};

export default function WaitlistPage() {
  return (
    <ComingSoon
      shipDay={3}
      title="Join the DividendMapper waitlist"
      blurb="Drop your email and we'll let you know the moment the calculators go live and when broker integrations open up. No spam, no drip sequence — one launch email, then occasional product updates."
      bullets={[
        "Free retirement and DCF calculators at launch (Day 10)",
        "First-look access to Trading 212 portfolio sync (Phase 3, Month 4)",
        "US broker connections via SnapTrade in Phase 4 (Month 7)",
      ]}
    />
  );
}
