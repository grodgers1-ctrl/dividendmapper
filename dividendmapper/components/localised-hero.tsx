"use client";

import { useLocale } from "@/lib/locale/context";

export function LocalisedHero() {
  const { config } = useLocale();
  const wrapperList = config.wrappers.primary.join(", ");
  return (
    <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
      Free dividend tracker and retirement calculator for{" "}
      <span className="font-medium text-foreground">
        UK and US dividend investors
      </span>
      . Built around{" "}
      <span className="font-medium text-foreground">{wrapperList}</span> and{" "}
      <span className="font-medium text-foreground">
        {config.wrappers.taxable}
      </span>{" "}
      accounts, modelled properly, not bolted on.
    </p>
  );
}
