import { initSentry, reportError } from "./sentry.ts";
import { boot } from "./app.ts";
import "./styles.css";

initSentry();

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("#app がありません");
}

void boot(root).catch((error: unknown) => {
  reportError(error);
  root.textContent = error instanceof Error ? error.message : "起動に失敗しました";
});
