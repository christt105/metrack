import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { UsageState } from './UsageState.js';

/** Keeps the usage state in a small JSON file, replaced atomically on every save. */
export class UsageStateStore {
  constructor(private readonly path: string) {}

  load(): UsageState {
    try {
      const parsed = JSON.parse(readFileSync(this.path, 'utf8')) as Partial<UsageState>;
      const sent: Record<string, number> = {};
      for (const [key, value] of Object.entries(parsed.sent ?? {})) {
        if (typeof value === 'number') sent[key] = value;
      }
      return {
        sent,
        failureNoticeDay:
          typeof parsed.failureNoticeDay === 'string' ? parsed.failureNoticeDay : undefined,
      };
    } catch {
      return { sent: {} };
    }
  }

  save(state: UsageState): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const temp = `${this.path}.tmp`;
    writeFileSync(temp, JSON.stringify(state));
    renameSync(temp, this.path);
  }
}
