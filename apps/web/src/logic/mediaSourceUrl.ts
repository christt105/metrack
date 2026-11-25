import type { Collection } from '@metrack/domain';

export function mediaSourceUrl(
  collection: Collection,
  detail: {
    tmdbId?: number | null;
    tmdbSeasonNumber?: number | null;
    steamAppId?: string | null;
    openLibraryId?: string | null;
  },
  parent?: { tmdbId: number | null; tmdbEpisodeGroup: string | null } | null,
): string | null {
  const tmdb = 'https://www.themoviedb.org';
  switch (collection) {
    case 'movies':
      return detail.tmdbId ? `${tmdb}/movie/${detail.tmdbId}` : null;
    case 'series':
      return detail.tmdbId ? `${tmdb}/tv/${detail.tmdbId}` : null;
    case 'seasons': {
      if (!parent?.tmdbId) return null;
      const seriesUrl = `${tmdb}/tv/${parent.tmdbId}`;
      if (parent.tmdbEpisodeGroup != null) return seriesUrl;
      return detail.tmdbSeasonNumber == null
        ? null
        : `${seriesUrl}/season/${detail.tmdbSeasonNumber}`;
    }
    case 'games':
      return detail.steamAppId
        ? `https://store.steampowered.com/app/${encodeURIComponent(detail.steamAppId)}`
        : null;
    case 'books': {
      const id = detail.openLibraryId;
      if (id?.endsWith('W')) return `https://openlibrary.org/works/${encodeURIComponent(id)}`;
      if (id?.endsWith('M')) return `https://openlibrary.org/books/${encodeURIComponent(id)}`;
      return null;
    }
  }
}
