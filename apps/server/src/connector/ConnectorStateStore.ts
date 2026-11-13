import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeFileAtomic } from '../mirror/writeFileAtomic.js';
import type { ConnectorState } from './ConnectorState.js';

const FILE = 'connector-state.json';

/** The connector's state in its data directory, written atomically. A missing or unreadable file reads as empty. */
export class ConnectorStateStore {
  private readonly path: string;

  constructor(dataDir: string) {
    this.path = join(dataDir, FILE);
  }

  read(): ConnectorState {
    if (!existsSync(this.path)) return { users: [], pending: {} };
    try {
      const parsed = JSON.parse(readFileSync(this.path, 'utf8')) as Partial<ConnectorState>;
      return { users: parsed.users ?? [], pending: parsed.pending ?? {} };
    } catch {
      return { users: [], pending: {} };
    }
  }

  write(state: ConnectorState): void {
    writeFileAtomic(this.path, `${JSON.stringify(state, null, 2)}\n`);
  }
}
