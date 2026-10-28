import { existsSync, readFileSync } from 'node:fs';
import type { MirrorState } from './MirrorState.js';

/** The notes the mirror wrote last time into `mirrorDir`, empty when it never ran there. */
export function readMirrorState(statePath: string, mirrorDir: string): string[] {
  if (!existsSync(statePath)) return [];
  const state = JSON.parse(readFileSync(statePath, 'utf8')) as Partial<MirrorState>;
  return state.mirrorDir === mirrorDir && Array.isArray(state.notes) ? state.notes : [];
}
