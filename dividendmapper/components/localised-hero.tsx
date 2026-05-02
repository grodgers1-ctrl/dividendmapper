"use client";

import { useLocale } from "@/lib/locale/context";

export function LocalisedHero() {
  const { config } = useLocale();
  const wrapperList = config.wrappers.primary.join(", ");
  return (
    <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
      Free retirement income and dividend valuation tools, built for{" "}
      <span className="font-medium text-foreground">
        {config.locale === "uk" ? "UK" : "US"} investors
      </span>{" "}
      using{" "}
      <span className="font-medium text-foreground">{wrapperList}</span>{" "}
      and{" "}
      <span className="font-medium text-foreground">
        {config.wrappers.taxable}
      </span>{" "}
      accounts.
    </p>
  );
}
