import { createD1Backend } from './d1Backend.js';
import { sqliteBackend } from './sqliteBackend.js';
import type { StorageBackend } from './StorageBackend.js';

/** Fresh backends for one test file: the repositories must behave the same on each. */
export function createBackends(): StorageBackend[] {
  return [sqliteBackend, createD1Backend()];
}
