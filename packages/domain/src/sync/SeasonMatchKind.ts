/** How a library season was paired with a stored season. `ordering` pairs by the season's number in the series' TMDB ordering. */
export type SeasonMatchKind = 'jellyfin_id' | 'air_date' | 'number' | 'ordering' | 'new';
