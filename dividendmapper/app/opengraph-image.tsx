import { ImageResponse } from "next/og";

export const alt =
  "DividendMapper — Free retirement and DCF calculators for UK and US dividend investors";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default Open Graph image for dividendmapper.com.
// Routes can override by creating their own opengraph-image.tsx.
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #020617 0%, #0F172A 60%, #064E3B 100%)",
          padding: 64,
          fontFamily: "sans-serif",
          color: "#F8FAFC",
          position: "relative",
        }}
      >
        {/* Decorative radial highlight in brand-green */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 480,
            height: 480,
            background:
              "radial-gradient(circle, rgba(14,168,116,0.35) 0%, rgba(14,168,116,0) 70%)",
            display: "flex",
          }}
        />

        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#059669",
              color: "#FFFFFF",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            DM
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#F8FAFC",
              display: "flex",
            }}
          >
            DividendMapper
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flexGrow: 1, display: "flex" }} />

        {/* Headline */}
        <div
          style={{
            fontSize: 78,
            fontWeight: 800,
            letterSpacing: "-0.035em",
            lineHeight: 1.05,
            color: "#F8FAFC",
            display: "flex",
            flexDirection: "column",
            maxWidth: 960,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            Free dividend&nbsp;tools
          </div>
          <div style={{ display: "flex" }}>
            for{" "}
            <span style={{ color: "#34D399", marginLeft: 18, marginRight: 18 }}>
              UK
            </span>
            &
            <span style={{ color: "#34D399", marginLeft: 18, marginRight: 18 }}>
              US
            </span>
            investors.
          </div>
        </div>

        {/* Subline */}
        <div
          style={{
            marginTop: 36,
            fontSize: 28,
            color: "#94A3B8",
            display: "flex",
            alignItems: "center",
            gap: 18,
            letterSpacing: "-0.005em",
          }}
        >
          <span style={{ display: "flex" }}>Retirement calculator</span>
          <span style={{ color: "#475569", display: "flex" }}>·</span>
          <span style={{ display: "flex" }}>Dividend DCF (DDM)</span>
          <span style={{ color: "#475569", display: "flex" }}>·</span>
          <span style={{ display: "flex" }}>3-scenario analysis</span>
        </div>

        {/* Bottom row */}
        <div
          style={{
            marginTop: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#64748B",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                display: "flex",
                width: 10,
                height: 10,
                borderRadius: 9999,
                background: "#0EA874",
              }}
            />
            <span style={{ display: "flex", color: "#CBD5E1" }}>
              dividendmapper.com
            </span>
          </div>
          <div style={{ display: "flex", color: "#94A3B8" }}>
            Free · No signup · Browser-only
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
