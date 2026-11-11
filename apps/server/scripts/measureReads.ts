import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Miniflare } from 'miniflare';
import sharp from 'sharp';
import type { D1Database } from '../src/storage/d1/D1Database.js';
import type { D1PreparedStatement } from '../src/storage/d1/D1PreparedStatement.js';
import type { D1Result } from '../src/storage/d1/D1Result.js';
import { createWorkerApp } from '../src/worker/createWorkerApp.js';
import type { WorkerEnv } from '../src/worker/WorkerEnv.js';

const FREE_READS_PER_DAY = 5_000_000;
const FREE_WRITES_PER_DAY = 100_000;
const USER_ID = 2;
const SECRET = 'mt_measure-reads-secret';

/** Visits per day for each route name; override with METRACK_PROFILE='{"home":100}'. */
const DEFAULT_PROFILE: Record<string, number> = {
  'public home': 60,
  'public stats': 15,
  'public collage': 5,
  'public about': 5,
  'public detail': 40,
  'public index.json': 5,
  'public feed.xml': 10,
  'public image': 600,
  'owner GET /api/media': 30,
  'owner GET title detail': 40,
  'owner GET /api/account': 5,
  'owner GET /api/settings': 10,
  'owner PATCH title': 15,
};

interface Counters {
  read: number;
  written: number;
}

class MeteredStatement implements D1PreparedStatement {
  constructor(
    private readonly inner: D1PreparedStatement,
    private readonly meter: Counters,
  ) {}

  bind(...values: never[]): D1PreparedStatement {
    return new MeteredStatement(this.inner.bind(...values), this.meter);
  }

  unwrap(): D1PreparedStatement {
    return this.inner;
  }

  async all(): Promise<D1Result> {
    return this.count(await this.inner.all());
  }

  async run(): Promise<D1Result> {
    return this.count(await this.inner.run());
  }

  async first(): Promise<never> {
    const result = await this.inner.all();
    this.count(result);
    return (result.results[0] ?? null) as never;
  }

  count(result: D1Result): D1Result {
    const meta = result.meta as unknown as { rows_read?: number; rows_written?: number };
    this.meter.read += meta.rows_read ?? 0;
    this.meter.written += meta.rows_written ?? 0;
    return result;
  }
}

function meterOf(db: D1Database, meter: Counters): D1Database {
  return {
    prepare: (sql) => new MeteredStatement(db.prepare(sql), meter),
    batch: async (statements) => {
      const results = await db.batch(
        statements.map((s) => (s instanceof MeteredStatement ? s.unwrap() : s)),
      );
      for (const result of results)
        new MeteredStatement(db.prepare('SELECT 1'), meter).count(result);
      return results;
    },
  };
}

function statements(file: string): string[] {
  return readFileSync(new URL(file, import.meta.url), 'utf8')
    .split(/;\s*\n/)
    .map((sql) => sql.trim())
    .filter((sql) => sql.length > 0);
}

interface Probe {
  name: string;
  method: 'GET' | 'PATCH';
  path: string;
  owner: boolean;
  session?: boolean;
  body?: unknown;
}

interface Sample {
  read: number;
  written: number;
  ms: number;
  status: number;
  etag: string | null;
}

const pad = (value: string | number, width: number): string => String(value).padStart(width);

async function main(): Promise<void> {
  const miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response(null); } };',
    d1Databases: { DB: 'metrack-measure' },
    r2Buckets: ['IMAGES'],
  });
  try {
    const raw = (await miniflare.getD1Database('DB')) as unknown as D1Database;
    const IMAGES = await miniflare.getR2Bucket('IMAGES');
    const bulk = execFileSync(
      'node',
      [new URL('../d1/seed/makeBulkData.mjs', import.meta.url).pathname],
      {
        encoding: 'utf8',
      },
    )
      .split(/;\s*\n/)
      .map((sql) => sql.trim())
      .filter((sql) => sql.length > 0);
    const migrations = readdirSync(new URL('../d1/migrations/', import.meta.url))
      .filter((file) => file.endsWith('.sql'))
      .sort();
    const seed = [
      ...migrations.flatMap((file) => statements(`../d1/migrations/${file}`)),
      ...statements('../d1/seed/test-data.sql'),
      ...bulk,
      `INSERT INTO session (id, user_id, created_at, expires_at) VALUES ('${createHash('sha256').update(SECRET).digest('hex')}', ${USER_ID}, '2026-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z')`,
      `INSERT INTO api_token (user_id, name, secret_hash, scope, created_at) VALUES (${USER_ID}, 'measure', '${createHash('sha256').update(SECRET).digest('hex')}', 'write', '2026-01-01T00:00:00.000Z')`,
    ];
    for (let i = 0; i < seed.length; i += 50) {
      await raw.batch(seed.slice(i, i + 50).map((sql) => raw.prepare(sql)));
    }

    const meter: Counters = { read: 0, written: 0 };
    const app = createWorkerApp({
      DB: meterOf(raw, meter),
      IMAGES,
      IMAGE_ENCODED_BY: 'server',
    } as unknown as WorkerEnv);
    const auth = { authorization: `Bearer ${SECRET}` };

    const webp = await sharp({
      create: { width: 40, height: 60, channels: 3, background: '#335577' },
    })
      .webp()
      .toBuffer();
    const upload = await app.request('http://localhost/api/images', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'image/webp' },
      body: webp as Uint8Array<ArrayBuffer>,
    });
    const uploaded = (await upload.json()) as { ref?: string };
    if (!uploaded.ref) throw new Error(`Image upload failed: ${JSON.stringify(uploaded)}`);
    const { ref } = uploaded;
    const covered = await app.request('http://localhost/api/movies/1000/images/cover', {
      method: 'PUT',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ url: ref }),
    });
    if (covered.status >= 400) throw new Error(`Setting the cover failed: ${covered.status}`);
    const hash = ref.slice('/api/images/'.length);

    const probes: Probe[] = [
      { name: 'public home', method: 'GET', path: '/u/bulk/', owner: false },
      { name: 'public stats', method: 'GET', path: '/u/bulk/stats', owner: false },
      { name: 'public collage', method: 'GET', path: '/u/bulk/collage', owner: false },
      { name: 'public about', method: 'GET', path: '/u/bulk/about', owner: false },
      { name: 'public detail', method: 'GET', path: '/u/bulk/movie/1001', owner: false },
      { name: 'public index.json', method: 'GET', path: '/u/bulk/index.json', owner: false },
      { name: 'public feed.xml', method: 'GET', path: '/u/bulk/feed.xml', owner: false },
      { name: 'public image', method: 'GET', path: `/u/bulk/images/${hash}`, owner: false },
      { name: 'owner GET /api/media', method: 'GET', path: '/api/media', owner: true },
      { name: 'owner GET title detail', method: 'GET', path: '/api/movies/1001', owner: true },
      {
        name: 'owner GET /api/account',
        method: 'GET',
        path: '/api/account',
        owner: true,
        session: true,
      },
      {
        name: 'owner GET /api/settings',
        method: 'GET',
        path: '/api/settings',
        owner: true,
        session: true,
      },
      {
        name: 'owner PATCH title',
        method: 'PATCH',
        path: '/api/movies/1002',
        owner: true,
        body: { note: 'measured' },
      },
    ];

    const sample = async (probe: Probe, revalidate?: string | null): Promise<Sample> => {
      meter.read = 0;
      meter.written = 0;
      const headers: Record<string, string> = probe.session
        ? { cookie: `metrack_session=${SECRET}` }
        : probe.owner
          ? { ...auth }
          : {};
      if (probe.body !== undefined) headers['content-type'] = 'application/json';
      if (revalidate) headers['if-none-match'] = revalidate;
      const started = performance.now();
      const response = await app.request(`http://localhost${probe.path}`, {
        method: probe.method,
        headers,
        body: probe.body === undefined ? undefined : JSON.stringify(probe.body),
      });
      await response.arrayBuffer();
      return {
        read: meter.read,
        written: meter.written,
        ms: performance.now() - started,
        status: response.status,
        etag: response.headers.get('etag'),
      };
    };

    const invalidate = async (): Promise<void> => {
      try {
        await raw.prepare('UPDATE user SET content_version = content_version + 1').run();
      } catch {
        return;
      }
    };

    const results = new Map<string, { cold: Sample; warm: Sample; revalidated?: Sample }>();
    for (const probe of probes) {
      await invalidate();
      const cold = await sample(probe);
      const warm = await sample(probe);
      const revalidated = warm.etag ? await sample(probe, warm.etag) : undefined;
      results.set(probe.name, { cold, warm, revalidated });
    }

    console.log(
      `${'route'.padEnd(26)} ${pad('cold r/w', 12)} ${pad('ms', 6)} | ${pad('warm r/w', 12)} ${pad('ms', 6)} | ${pad('304 r/w', 10)} ${pad('ms', 6)}  status`,
    );
    for (const [name, { cold, warm, revalidated }] of results) {
      const cell = (s?: Sample): string => (s ? `${s.read}/${s.written}` : '-');
      const ms = (s?: Sample): string => (s ? s.ms.toFixed(1) : '-');
      console.log(
        `${name.padEnd(26)} ${pad(cell(cold), 12)} ${pad(ms(cold), 6)} | ${pad(cell(warm), 12)} ${pad(ms(warm), 6)} | ${pad(cell(revalidated), 10)} ${pad(ms(revalidated), 6)}  ${cold.status}/${warm.status}${revalidated ? `/${revalidated.status}` : ''}`,
      );
    }

    const profile: Record<string, number> = {
      ...DEFAULT_PROFILE,
      ...(process.env.METRACK_PROFILE ? JSON.parse(process.env.METRACK_PROFILE) : {}),
    };
    const writesPerDay = Number(process.env.METRACK_WRITES_PER_DAY ?? 5);
    let reads = 0;
    let writes = 0;
    for (const [name, visits] of Object.entries(profile)) {
      const result = results.get(name);
      if (!result) continue;
      if (name.startsWith('owner')) {
        reads += visits * result.cold.read;
        writes += visits * result.cold.written;
        continue;
      }
      const cold = Math.min(visits, writesPerDay);
      reads += cold * result.cold.read + (visits - cold) * result.warm.read;
      writes += cold * result.cold.written + (visits - cold) * result.warm.written;
    }
    const share = (value: number, limit: number): string =>
      `${((value / limit) * 100).toFixed(2)}%`;
    console.log(
      `\nEstimated per day (${Object.values(profile).reduce((a, b) => a + b, 0)} requests, ${writesPerDay} owner edits/day invalidating the cache)`,
    );
    console.log(
      `  rows read    ${pad(reads, 10)}  ${share(reads, FREE_READS_PER_DAY)} of ${FREE_READS_PER_DAY}`,
    );
    console.log(
      `  rows written ${pad(writes, 10)}  ${share(writes, FREE_WRITES_PER_DAY)} of ${FREE_WRITES_PER_DAY} (shared with another project)`,
    );
  } finally {
    await miniflare.dispose();
  }
}

await main();
