"use client";

import { useState } from "react";
import Image from "next/image";
import { InitialsTile } from "./initials-tile";

interface Props {
  ticker: string;
  name?: string;
  size?: number;
}

export function HoldingLogo({ ticker, name, size = 32 }: Props) {
  const [errored, setErrored] = useState(false);
  if (errored) return <InitialsTile ticker={ticker} size={size} />;

  const token = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_API_KEY ?? "";
  const url = `https://img.logo.dev/ticker/${ticker}?token=${token}&size=${size * 2}&retina=true&format=webp&fallback=404`;

  return (
    <Image
      src={url}
      width={size}
      height={size}
      alt={`${name ?? ticker} logo`}
      className="rounded-md border border-border/40 bg-card object-contain"
      onError={() => setErrored(true)}
    />
  );
}
