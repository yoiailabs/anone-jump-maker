import { boot } from "./app.ts";
import "./styles.css";

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("#app がありません");
}

void boot(root).catch((error: unknown) => {
  root.textContent = error instanceof Error ? error.message : "起動に失敗しました";
});
