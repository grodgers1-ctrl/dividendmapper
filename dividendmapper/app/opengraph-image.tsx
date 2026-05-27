import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const alt =
  "DividendMapper: Free retirement and DCF calculators for UK and US dividend investors";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default Open Graph image for dividendmapper.com.
// Routes can override by creating their own opengraph-image.tsx.
export default async function Image() {
  // Embed the logo as base64 so it works in both dev and production (Edge runtime)
  const logoBuffer = readFileSync(join(process.cwd(), "public/logo-pin.png"));
  const logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #020617 0%, #0F172A 60%, #064E3B 100%)",
          fontFamily: "sans-serif",
          color: "#F8FAFC",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Soft green radial glow — top right */}
        <div
          style={{
            position: "absolute",
            top: -160,
            right: -160,
            width: 600,
            height: 600,
            background:
              "radial-gradient(circle, rgba(14,168,116,0.28) 0%, rgba(14,168,116,0) 70%)",
            display: "flex",
          }}
        />

        {/* Left column — text */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            padding: "60px 0px 60px 64px",
          }}
        >
          {/* Wordmark row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoBase64} width={52} height={52} alt="" />
            <div
              style={{
                display: "flex",
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#F8FAFC",
              }}
            >
              Dividend
              <span style={{ color: "#34D399" }}>Mapper</span>
            </div>
          </div>

          {/* Headline */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 76,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                lineHeight: 1.0,
                color: "#F8FAFC",
                display: "flex",
                flexWrap: "wrap",
              }}
            >
              Know your dividend
            </div>
            <div
              style={{
                fontSize: 76,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                lineHeight: 1.0,
                color: "#34D399",
                display: "flex",
              }}
            >
              income.
            </div>
            <div
              style={{
                marginTop: 24,
                fontSize: 26,
                color: "#94A3B8",
                display: "flex",
                alignItems: "center",
                gap: 16,
                letterSpacing: "-0.01em",
              }}
            >
              <span style={{ display: "flex" }}>Retirement calculator</span>
              <span style={{ color: "#334155", display: "flex" }}>·</span>
              <span style={{ display: "flex" }}>Dividend DDM</span>
              <span style={{ color: "#334155", display: "flex" }}>·</span>
              <span style={{ display: "flex" }}>🇬🇧 UK &amp; 🇺🇸 US</span>
            </div>
          </div>

          {/* Bottom domain row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 20,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 9999,
                background: "#0EA874",
                display: "flex",
              }}
            />
            <span style={{ color: "#64748B", display: "flex" }}>
              dividendmapper.com
            </span>
            <span style={{ color: "#1E293B", display: "flex", marginLeft: 8 }}>
              ·
            </span>
            <span style={{ color: "#475569", display: "flex" }}>
              Free · No signup
            </span>
          </div>
        </div>

        {/* Right column — large logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 340,
            flexShrink: 0,
            paddingRight: 48,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoBase64}
            width={280}
            height={280}
            alt=""
            style={{
              filter: "drop-shadow(0 0 60px rgba(14,168,116,0.45))",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
