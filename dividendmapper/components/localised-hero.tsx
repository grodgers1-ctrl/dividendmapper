"use client";

import { useLocale } from "@/lib/locale/context";

export function LocalisedHero() {
  const { config } = useLocale();
  const wrapperList = config.wrappers.primary.join(", ");
  return (
    <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
          Free UK dividend tracker and retirement income calculator. See how much
          income your portfolio could produce at retirement under Bear, Base and
          Bull scenarios, built around{" "}
          <span className="font-medium text-foreground">{wrapperList}</span> and{" "}
          <span className="font-medium text-foreground">
            {config.wrappers.taxable}
          </span>{" "}
          accounts, modelled properly, not bolted on.
        </p>
  );
}
