import type {
  EpisodeOperation,
  NextEpisodesResponse,
  SeasonEpisodesResponse,
  SeasonEpisodesUpdateResponse,
  EpisodeGroupOptions,
} from '@metrack/domain';
import type { Detail } from '../Detail';
import type { HttpTransport } from '../HttpTransport';

export class SeasonsApi {
  constructor(private readonly transport: HttpTransport) {}

  nextEpisodes(series?: number): Promise<NextEpisodesResponse> {
    return this.transport.request('GET', series === undefined ? '/next' : `/next?series=${series}`);
  }

  hideFromNext(seriesId: number): Promise<void> {
    return this.transport.request('PUT', `/series/${seriesId}/next-hidden`);
  }

  showInNext(seriesId: number): Promise<void> {
    return this.transport.request('DELETE', `/series/${seriesId}/next-hidden`);
  }

  seasonEpisodes(seasonId: number): Promise<SeasonEpisodesResponse> {
    return this.transport.request('GET', `/seasons/${seasonId}/episodes`);
  }

  updateSeasonEpisodes(
    seasonId: number,
    operation: EpisodeOperation,
  ): Promise<SeasonEpisodesUpdateResponse> {
    return this.transport.request('PATCH', `/seasons/${seasonId}/episodes`, operation);
  }

  restartSeason(seasonId: number): Promise<SeasonEpisodesUpdateResponse> {
    return this.transport.request('POST', `/seasons/${seasonId}/restart`);
  }

  undoSeasonRestart(seasonId: number, day?: string): Promise<SeasonEpisodesUpdateResponse> {
    return this.transport.request(
      'DELETE',
      `/seasons/${seasonId}/restart${day === undefined ? '' : `?day=${day}`}`,
    );
  }

  removeSeasonPass(seasonId: number, pass: number): Promise<SeasonEpisodesUpdateResponse> {
    return this.transport.request('DELETE', `/seasons/${seasonId}/passes/${pass}`);
  }

  setSeasonRewatchIntent(seasonId: number, wanted: boolean): Promise<SeasonEpisodesUpdateResponse> {
    return this.transport.request('PUT', `/seasons/${seasonId}/rewatch-intent`, { wanted });
  }

  episodeGroups(seriesId: number): Promise<EpisodeGroupOptions> {
    return this.transport.request('GET', `/series/${seriesId}/episode-groups`);
  }

  setSeasonOrdering(
    seriesId: number,
    episodeGroup: string | null,
    options: { forAll?: boolean } = {},
  ): Promise<Detail<'series'>> {
    const query = options.forAll ? '?forAll=true' : '';
    return this.transport.request('PUT', `/series/${seriesId}/season-ordering${query}`, {
      episodeGroup,
    });
  }
}
