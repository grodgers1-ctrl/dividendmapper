"use client";

import { useLocale } from "@/lib/locale/context";

export function LocalisedHero() {
  const { config } = useLocale();
  const wrapperList = config.wrappers.primary.join(", ");
  return (
    <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
      Free tools for{" "}
      <span className="font-medium text-foreground">
        UK and US dividend investors
      </span>
      . Work out when you can retire, and what your stocks are worth. Built
      around{" "}
      <span className="font-medium text-foreground">{wrapperList}</span> and{" "}
      <span className="font-medium text-foreground">
        {config.wrappers.taxable}
      </span>{" "}
      accounts.
    </p>
  );
}
