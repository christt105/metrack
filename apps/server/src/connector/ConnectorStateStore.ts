import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeFileAtomic } from '../mirror/writeFileAtomic.js';
import type { ConnectorState } from './ConnectorState.js';

const FILE = 'connector-state.json';

function emptyState(): ConnectorState {
  return { users: [], pending: {}, alertsSent: { day: '', count: 0 } };
}

/** The connector's state in its data directory, written atomically. A missing or unreadable file reads as empty. */
export class ConnectorStateStore {
  private readonly path: string;

  constructor(dataDir: string) {
    this.path = join(dataDir, FILE);
  }

  read(): ConnectorState {
    if (!existsSync(this.path)) return emptyState();
    try {
      const parsed = JSON.parse(readFileSync(this.path, 'utf8')) as Partial<ConnectorState>;
      return {
        users: parsed.users ?? [],
        pending: parsed.pending ?? {},
        alertsSent: parsed.alertsSent ?? { day: '', count: 0 },
      };
    } catch {
      return emptyState();
    }
  }

  write(state: ConnectorState): void {
    writeFileAtomic(this.path, `${JSON.stringify(state, null, 2)}\n`);
  }
}
