/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
}

interface Window {
  gtag?: (command: string, ...args: unknown[]) => void;
}
