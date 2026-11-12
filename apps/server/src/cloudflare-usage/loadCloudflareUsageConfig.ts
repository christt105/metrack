import type { CloudflareUsageConfig } from './CloudflareUsageConfig.js';
import type { UsageMetricKey } from './UsageMetricKey.js';

const GB = 1024 ** 3;

const LIMIT_ENV: Record<UsageMetricKey, { env: string; fallback: number }> = {
  workerRequests: { env: 'CLOUDFLARE_LIMIT_WORKER_REQUESTS', fallback: 100_000 },
  d1RowsRead: { env: 'CLOUDFLARE_LIMIT_D1_ROWS_READ', fallback: 5_000_000 },
  d1RowsWritten: { env: 'CLOUDFLARE_LIMIT_D1_ROWS_WRITTEN', fallback: 100_000 },
  d1Storage: { env: 'CLOUDFLARE_LIMIT_D1_STORAGE_BYTES', fallback: 5 * GB },
  r2ClassA: { env: 'CLOUDFLARE_LIMIT_R2_CLASS_A', fallback: 1_000_000 },
  r2ClassB: { env: 'CLOUDFLARE_LIMIT_R2_CLASS_B', fallback: 10_000_000 },
  r2Storage: { env: 'CLOUDFLARE_LIMIT_R2_STORAGE_BYTES', fallback: 10 * GB },
};

type Env = Record<string, string | undefined>;

/** Reads the usage monitor settings. Undefined when the token or the account id is missing. */
export function loadCloudflareUsageConfig(env: Env): CloudflareUsageConfig | undefined {
  const token = env.CLOUDFLARE_USAGE_TOKEN;
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId) return undefined;
  if (!/^[A-Za-z0-9]+$/.test(accountId)) {
    throw new Error(`Invalid CLOUDFLARE_ACCOUNT_ID: ${accountId}`);
  }
  const limits = {} as Record<UsageMetricKey, number>;
  for (const key of Object.keys(LIMIT_ENV) as UsageMetricKey[]) {
    limits[key] = positive(env, LIMIT_ENV[key].env, LIMIT_ENV[key].fallback);
  }
  const warnPercent = positive(env, 'CLOUDFLARE_USAGE_WARN_PERCENT', 70);
  const criticalPercent = positive(env, 'CLOUDFLARE_USAGE_CRITICAL_PERCENT', 90);
  if (warnPercent >= criticalPercent) {
    throw new Error(
      'CLOUDFLARE_USAGE_WARN_PERCENT must be lower than CLOUDFLARE_USAGE_CRITICAL_PERCENT',
    );
  }
  return { token, accountId, limits, warnPercent, criticalPercent };
}

function positive(env: Env, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid ${key}: ${raw}`);
  return value;
}
