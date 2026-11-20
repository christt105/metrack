const ANIMATED = /^(animation|animaci[oó]n|anime)$/;

/** Whether a series' genre names include animation (TMDB's "Animation", its Spanish "Animación" or "Anime"). */
export function isAnimatedGenres(genres: readonly string[]): boolean {
  return genres.some((genre) => ANIMATED.test(genre.trim().toLowerCase()));
}
