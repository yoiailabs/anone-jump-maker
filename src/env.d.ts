/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly PUBLIC_GA4_MEASUREMENT_ID?: string;
}

interface Window {
  gtag?: (command: string, ...args: unknown[]) => void;
  __gtagRequested?: boolean;
}
