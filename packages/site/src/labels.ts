import type { PublicKind } from './PublicKind.js';
import type { ThemeType } from './themeType.js';

export const KIND_LABELS: Record<PublicKind, string> = {
  movie: 'Película',
  series: 'Serie',
  season: 'Temporada',
  videogame: 'Videojuego',
  book: 'Libro',
};

export const TYPE_LABELS: Record<ThemeType, string> = {
  movie: 'Película',
  tv: 'Serie',
  season: 'Temporada',
  videogame: 'Videojuego',
  book: 'Libro',
};

export const TYPE_PLURALS: Record<ThemeType, string> = {
  movie: 'Películas',
  tv: 'Series',
  season: 'Temporadas',
  videogame: 'Juegos',
  book: 'Libros',
};

export const STATUS_LABELS: Record<string, string> = {
  finished: 'Acabado',
  in_progress: 'En curso',
  paused: 'Pausado',
  dropped: 'Abandonado',
  not_started: 'Sin Empezar',
};
