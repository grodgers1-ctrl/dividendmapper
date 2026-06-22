import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import { LocaleProvider } from "@/lib/locale/context";
import { PostHogProvider } from "@/components/posthog-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://dividendmapper.com"),
  title: {
    default: "DividendMapper: UK & US dividend portfolio tracker",
    template: "%s | DividendMapper",
  },
  description:
    "Free retirement income and dividend valuation calculators for UK (ISA, SIPP, GIA) and US (401(k), IRA, taxable) investors.",
  openGraph: {
    type: "website",
    siteName: "DividendMapper",
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

// Site-wide JSON-LD. Organization disambiguates the brand for LLM search
// (ChatGPT, Perplexity, Google AI Overviews) — `sameAs` is the lever to
// add as official profiles go live. WebSite ties the URL to the entity.
// Per SEO-AEO-AUDIT.md C2 (2026-06-22).
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://dividendmapper.com#org",
  name: "DividendMapper",
  url: "https://dividendmapper.com",
  logo: "https://dividendmapper.com/icon.png",
  description:
    "Free dividend portfolio tools and resilience scoring for UK and US investors.",
  sameAs: [] as string[],
};

const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  url: "https://dividendmapper.com",
  name: "DividendMapper",
  publisher: { "@id": "https://dividendmapper.com#org" },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // proxy.ts injects x-pathname for /app/* (its matcher). For marketing
  // routes the header is absent and the fallback ("/") doesn't match —
  // chrome shows. /app/* owns its own shell via DrawerShell and must not
  // render the marketing SiteHeader/SiteFooter on top of it.
  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname") ?? "/";
  const showMarketingChrome = !pathname.startsWith("/app");

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([ORGANIZATION_JSON_LD, WEBSITE_JSON_LD]),
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PostHogProvider>
            <LocaleProvider>
              {showMarketingChrome ? (
                <>
                  <SiteHeader />
                  <main className="flex-1">{children}</main>
                  <SiteFooter />
                </>
              ) : (
                // /app/* routes own their own <main> via DrawerShell. Wrapping
                // here would produce a nested + duplicate main landmark
                // (axe-reported 2026-06-22). Pass children through bare.
                children
              )}
            </LocaleProvider>
          </PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
