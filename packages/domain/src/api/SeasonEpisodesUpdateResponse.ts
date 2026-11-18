import type { SeasonTracking } from '../SeasonTracking.js';
import type { SeasonEpisodesResponse } from './SeasonEpisodesResponse.js';

/** The answer to a change of watched episodes: the episodes as `GET` gives them plus the season's tracking after the change. */
export interface SeasonEpisodesUpdateResponse extends SeasonEpisodesResponse {
  tracking: SeasonTracking;
}
