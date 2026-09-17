/// <reference types="vite/client" />

interface Window {
  gtag?: (command: string, ...args: unknown[]) => void;
}
