import { addConsumer } from './addConsumer.js';
import { classifyR2Action } from './classifyR2Action.js';
import { CloudflareUsageError } from './CloudflareUsageError.js';
import type { UsageSample } from './UsageSample.js';
import { toReading } from './toReading.js';
import { utcDay, utcMonthStart } from './usagePeriods.js';

const ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

interface Group<S extends string, D extends string> {
  sum?: Partial<Record<S, number>>;
  max?: Partial<Record<S, number>>;
  dimensions?: Partial<Record<D, string>>;
}

interface Account {
  w?: Group<'requests', 'scriptName'>[];
  d?: Group<'rowsRead' | 'rowsWritten', 'databaseId'>[];
  r?: Group<'requests', 'actionType' | 'bucketName'>[];
  s?: Group<'payloadSize', 'bucketName'>[];
  ds?: Group<'databaseSizeBytes', 'databaseId'>[];
}

/** Reads the account usage from Cloudflare's GraphQL Analytics API. */
export class CloudflareUsageClient {
  constructor(
    private readonly token: string,
    private readonly accountId: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Throws a CloudflareUsageError when the query fails. */
  async read(): Promise<UsageSample> {
    const day = utcDay(this.now());
    const month = utcMonthStart(this.now());
    const account = await this.query(`{ viewer { accounts(filter:{accountTag:"${this.accountId}"}) {
      w: workersInvocationsAdaptive(limit:100, filter:{date_geq:"${day}"}) { sum { requests } dimensions { scriptName } }
      d: d1AnalyticsAdaptiveGroups(limit:100, filter:{date_geq:"${day}"}) { sum { rowsRead rowsWritten } dimensions { databaseId } }
      r: r2OperationsAdaptiveGroups(limit:1000, filter:{date_geq:"${month}"}) { sum { requests } dimensions { actionType bucketName } }
      s: r2StorageAdaptiveGroups(limit:100, filter:{date_geq:"${day}"}) { max { payloadSize } dimensions { bucketName } }
      ds: d1StorageAdaptiveGroups(limit:100, filter:{date_geq:"${day}"}) { max { databaseSizeBytes } dimensions { databaseId } }
    } } }`);
    return this.aggregate(account);
  }

  private aggregate(account: Account): UsageSample {
    const workers = new Map<string, number>();
    for (const g of account.w ?? []) {
      addConsumer(workers, g.dimensions?.scriptName ?? 'unknown', g.sum?.requests ?? 0);
    }
    const rowsRead = new Map<string, number>();
    const rowsWritten = new Map<string, number>();
    for (const g of account.d ?? []) {
      const id = (g.dimensions?.databaseId ?? 'unknown').slice(0, 8);
      addConsumer(rowsRead, id, g.sum?.rowsRead ?? 0);
      addConsumer(rowsWritten, id, g.sum?.rowsWritten ?? 0);
    }
    const classA = new Map<string, number>();
    const classB = new Map<string, number>();
    const unknown = new Set<string>();
    for (const g of account.r ?? []) {
      const action = g.dimensions?.actionType ?? 'unknown';
      const kind = classifyR2Action(action);
      if (kind === 'free') continue;
      if (kind === 'unknown') unknown.add(action);
      const bucket = g.dimensions?.bucketName || 'account';
      addConsumer(kind === 'B' ? classB : classA, bucket, g.sum?.requests ?? 0);
    }
    const buckets = new Map<string, number>();
    for (const g of account.s ?? []) {
      const name = g.dimensions?.bucketName ?? 'unknown';
      buckets.set(name, Math.max(buckets.get(name) ?? 0, g.max?.payloadSize ?? 0));
    }
    const databases = new Map<string, number>();
    for (const g of account.ds ?? []) {
      const id = (g.dimensions?.databaseId ?? 'unknown').slice(0, 8);
      databases.set(id, Math.max(databases.get(id) ?? 0, g.max?.databaseSizeBytes ?? 0));
    }
    const d1Storage = toReading(databases);
    d1Storage.used = d1Storage.consumers[0]?.value ?? 0;
    return {
      readings: {
        d1Storage,
        workerRequests: toReading(workers),
        d1RowsRead: toReading(rowsRead),
        d1RowsWritten: toReading(rowsWritten),
        r2ClassA: toReading(classA),
        r2ClassB: toReading(classB),
        r2Storage: toReading(buckets),
      },
      unknownR2Actions: [...unknown],
    };
  }

  private async query(query: string): Promise<Account> {
    let response: Response;
    try {
      response = await this.fetchFn(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new CloudflareUsageError(
        `network error: ${error instanceof Error ? error.message : String(error)}`.slice(0, 160),
      );
    }
    if (response.status !== 200) throw new CloudflareUsageError(`HTTP ${response.status}`);
    let body: {
      data?: { viewer?: { accounts?: Account[] } };
      errors?: { message?: string }[] | null;
    };
    try {
      body = (await response.json()) as typeof body;
    } catch {
      throw new CloudflareUsageError('response was not JSON');
    }
    if (body.errors?.length) {
      const message = body.errors[0]?.message ?? 'unknown error';
      throw new CloudflareUsageError(`GraphQL error: ${message}`.slice(0, 160));
    }
    const account = body.data?.viewer?.accounts?.[0];
    if (!account) throw new CloudflareUsageError('account not found in the response');
    return account;
  }
}
