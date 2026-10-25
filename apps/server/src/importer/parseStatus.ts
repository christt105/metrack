import type { MediaStatus } from '@metrack/domain';
import { readText } from './fieldReaders.js';

const STATUS_BY_LABEL: Record<string, MediaStatus> = {
  'sin empezar': 'planned',
  'not started': 'planned',
  planned: 'planned',
  'en curso': 'in_progress',
  'in progress': 'in_progress',
  in_progress: 'in_progress',
  pausado: 'paused',
  paused: 'paused',
  abandonado: 'dropped',
  dropped: 'dropped',
  acabado: 'completed',
  finished: 'completed',
  completed: 'completed',
};

export type StatusRead = { value: MediaStatus; problem: 'missing' | 'unknown' | null };

/** Maps the plugin's Spanish status labels to the model's statuses. */
export function parseStatus(value: unknown): StatusRead {
  const raw = readText(value);
  if (raw === null) return { value: 'planned', problem: 'missing' };
  const status = STATUS_BY_LABEL[raw.toLowerCase()];
  return status ? { value: status, problem: null } : { value: 'planned', problem: 'unknown' };
}
