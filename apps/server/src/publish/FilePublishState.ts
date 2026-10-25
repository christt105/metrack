import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { PublishState } from './PublishState.js';

export class FilePublishState implements PublishState {
  constructor(private readonly path: string) {}

  lastFingerprint(): string | null {
    if (!existsSync(this.path)) return null;
    try {
      const parsed = JSON.parse(readFileSync(this.path, 'utf8')) as { fingerprint?: unknown };
      return typeof parsed.fingerprint === 'string' ? parsed.fingerprint : null;
    } catch {
      return null;
    }
  }

  record(fingerprint: string): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const temp = `${this.path}.tmp`;
    writeFileSync(temp, JSON.stringify({ fingerprint }));
    renameSync(temp, this.path);
  }
}
