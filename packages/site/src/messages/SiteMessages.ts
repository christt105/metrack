import type { ThemeType } from '../themeType.js';

/** The shape every language dictionary of the public pages fills. */
export interface SiteMessages {
  /** The language of the pages, for the `lang` attribute and the feed. */
  lang: string;
  /** The locale numbers are written in. */
  numberLocale: string;
  /** The locale texts are sorted in. */
  collation: string;
  typeLabels: Record<ThemeType, string>;
  typePlurals: Record<ThemeType, string>;
  statusLabels: Record<string, string>;
  ratingLabels: {
    crown: string;
    heart: string;
    thumbsUp: string;
    smile: string;
    thumbsDown: string;
    dizzy: string;
    skull: string;
  };
  /** The twelve short month names, January first. */
  months: string[];
  /** A day as written in the text: the day number, the short month name and the year. */
  dateFormat: (day: number, month: string, year: string) => string;
  contentLabel: string;
  seasonNumber: (number: number) => string;
  menu: {
    library: string;
    collage: string;
    stats: string;
    about: string;
    icon: string;
    ariaLabel: string;
  };
  footer: {
    rss: string;
    servedBy: (link: string) => string;
    tmdbNotice: string;
    toTop: string;
  };
  home: {
    emptyLibrary: string;
    noneCompleted: string;
    unknownYear: string;
    completed: string;
    setAside: (count: number) => string;
  };
  filter: {
    all: string;
    platforms: string;
    tags: string;
    more: string;
    search: string;
    noResults: string;
  };
  card: { hasReview: string; allAchievements: string };
  detail: {
    developer: string;
    achievements: string;
    author: string;
    rewatches: string;
    abandoned: string;
    abandonedPass: (
      startedAt: string | null,
      finishedAt: string | null,
      restartedOn: string,
    ) => string;
    seasons: string;
    series: string;
    synopsis: string;
    banner: string;
  };
  feed: {
    title: (handle: string) => string;
    description: (handle: string) => string;
    ratingNote: (rating: number, label: string) => string;
  };
  stats: {
    allAchievements: string;
    title: string;
    total: string;
    finished: string;
    averageRating: string;
    ratingDistribution: string;
    finishedPerYear: string;
    averageRatingPerYear: string;
    topGenres: string;
    yearSelector: string;
    allYears: string;
    platforms: string;
    animeContent: string;
    anime: string;
    nonAnime: string;
    cinemaVsStreaming: string;
    cinema: string;
    streaming: string;
    timeSpent: string;
    timeSpentPerYear: string;
    hoursUnit: string;
    timeMissing: (count: number) => string;
  };
  collage: {
    title: string;
    hideControls: string;
    showControls: string;
    settings: string;
    from: string;
    to: string;
    type: string;
    movies: string;
    series: string;
    games: string;
    books: string;
    columns: string;
    itemsFound: string;
    download: string;
    generating: string;
    tooLarge: string;
    failed: string;
  };
  notFound: { title: string; body: string };
  privacy: {
    title: string;
    servedBy: string;
    body: (email: string, tmdbLogo: string) => string;
  };
}
