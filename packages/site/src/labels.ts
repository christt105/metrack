import type { PublicKind } from './PublicKind.js';

export const KIND_LABELS: Record<PublicKind, string> = {
  movie: 'Película',
  series: 'Serie',
  season: 'Temporada',
  videogame: 'Videojuego',
  book: 'Libro',
};

export const STATUS_LABELS: Record<string, string> = {
  finished: 'Acabado',
  in_progress: 'En curso',
  paused: 'Pausado',
  dropped: 'Abandonado',
  not_started: 'Sin Empezar',
};
