/**
 * Workers Builds のビルド変数は本番と Preview で分かれない。
 * `WORKERS_CI` があるビルドでは、本番ブランチのときだけ計測値を埋め込む。
 * ローカルや fork の CI は `WORKERS_CI` が無いので、自分の変数をそのまま使う。
 *
 * https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#environment-variables
 */
export const PRODUCTION_BRANCH = "main";

export const TELEMETRY_ENV_KEYS = ["VITE_SENTRY_DSN", "PUBLIC_GA4_MEASUREMENT_ID"] as const;

export function shouldEmbedTelemetry(env: {
  WORKERS_CI?: string;
  WORKERS_CI_BRANCH?: string;
}): boolean {
  if (!env.WORKERS_CI?.trim()) return true;
  return env.WORKERS_CI_BRANCH?.trim() === PRODUCTION_BRANCH;
}

/** Preview の Workers Builds では計測用の環境変数を消す。値そのものは返さない。 */
export function applyWorkersCiTelemetryGate(env: Record<string, string | undefined>): boolean {
  const embed = shouldEmbedTelemetry(env);
  if (!embed) {
    for (const key of TELEMETRY_ENV_KEYS) delete env[key];
  }
  return embed;
}
