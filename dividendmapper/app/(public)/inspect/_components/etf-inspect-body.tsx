import { loadEtfBundle } from "@/lib/etf/load-etf-bundle";
import { EtfMetadataBar } from "./etf-metadata-bar";
import { EtfSnapshotStrip } from "./etf-snapshot-strip";
import { EtfHoldingsCard } from "./etf-holdings-card";
import { EtfSectorCard } from "./etf-sector-card";
import { EtfCountryCard } from "./etf-country-card";
import { EtfQualityBreakdown } from "./etf-quality-breakdown";
import { HoldingLogo } from "@/app/app/portfolio/_components/holding-logo";

export async function EtfInspectBody({ ticker }: { ticker: string }) {
  const b = await loadEtfBundle(ticker);
  const name = b.universe?.name ?? ticker;

  return (
    <article className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-text-muted">
        <a href="/inspect" className="hover:text-text">Inspect</a>
        <span className="px-2">/</span>
        <span className="text-text">{ticker}</span>
      </nav>
      <header className="mb-4 flex items-center gap-4">
        <HoldingLogo ticker={ticker} size={56} />
        <div>
          <h1 className="font-mono text-3xl tracking-tight">{ticker}</h1>
          <p className="text-text-muted">
            {name}
            {b.universe?.family ? ` · by ${b.universe.family}` : ""}
          </p>
        </div>
      </header>
      <EtfMetadataBar universe={b.universe} facts={b.facts} />
      <EtfSnapshotStrip facts={b.facts} />
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <EtfHoldingsCard
          holdings={b.holdings}
          totalCount={b.facts?.holdings_count ?? null}
          refreshedAt={b.holdings_refreshed_at}
        />
        <EtfSectorCard sectors={b.sectors} />
        <EtfCountryCard countries={b.countries} />
      </section>
      <EtfQualityBreakdown facts={b.facts} />
    </article>
  );
}
