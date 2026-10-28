import type { MediaStatus } from '@metrack/domain';

const LABELS: Record<MediaStatus, string> = {
  planned: 'Sin Empezar',
  in_progress: 'En Curso',
  paused: 'Pausado',
  dropped: 'Abandonado',
  completed: 'Acabado',
};

/** The Spanish status label the Obsidian plugin writes. */
export function statusLabel(status: MediaStatus): string {
  return LABELS[status];
}
