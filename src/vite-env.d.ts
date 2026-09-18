/// <reference types="vite/client" />

declare module "*.wasm?url" {
  const url: string;
  export default url;
}

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
}

interface Window {
  gtag?: (command: string, ...args: unknown[]) => void;
}
