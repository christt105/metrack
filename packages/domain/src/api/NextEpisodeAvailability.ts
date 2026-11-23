/**
 * `ready` when the episode has aired and can be marked, `airs` when it has not aired yet (`airsOn` is its date),
 * `premieres` when the season has no aired episode yet (`airsOn` is the date of its first).
 */
export type NextEpisodeAvailability = 'ready' | 'airs' | 'premieres';
