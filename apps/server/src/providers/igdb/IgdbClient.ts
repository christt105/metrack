import type { FetchFn } from '../../http/FetchFn.js';
import { HttpError } from '../../http/HttpError.js';
import type { IgdbClientOptions } from './IgdbClientOptions.js';
import type { IgdbExternalGame } from './IgdbExternalGame.js';
import type { IgdbGame } from './IgdbGame.js';

const GAMES_URL = 'https://api.igdb.com/v4/games';
const EXTERNAL_GAMES_URL = 'https://api.igdb.com/v4/external_games';
const AUTH_URL = 'https://id.twitch.tv/oauth2/token';
const SEARCH_FIELDS = 'fields name, first_release_date, summary, cover.url;';
const GAME_FIELDS =
  'fields name, first_release_date, summary, storyline, cover.url, screenshots.url, genres.name, ' +
  'platforms.name, involved_companies.developer, involved_companies.company.name, ' +
  'external_games.external_game_source, external_games.uid;';

function quote(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * IGDB games API. Access tokens come from Twitch's client credentials flow; one is kept in memory until
 * shortly before it expires, and a request answered 401 gets a new token and is retried once.
 */
export class IgdbClient {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly fetchFn: FetchFn,
    private readonly options: IgdbClientOptions,
    private readonly now: () => number = Date.now,
  ) {}

  /** Games matching `query`, optionally released in `year` (UTC). */
  search(query: string, year: number | null): Promise<IgdbGame[]> {
    const where =
      year === null
        ? ''
        : ` where first_release_date >= ${Date.UTC(year, 0, 1) / 1000} & first_release_date < ${Date.UTC(year + 1, 0, 1) / 1000};`;
    return this.games(`${SEARCH_FIELDS} search ${quote(query)};${where} limit 20;`);
  }

  async game(id: number): Promise<IgdbGame | null> {
    const [game] = await this.games(`${GAME_FIELDS} where id = ${id};`);
    return game ?? null;
  }

  /** The IGDB game id of each given Steam app id that IGDB knows; at most 500 app ids per call. */
  async gamesBySteamApp(appIds: readonly string[]): Promise<Map<string, number>> {
    const found = new Map<string, number>();
    if (appIds.length === 0) return found;
    const list = appIds.map(quote).join(',');
    const rows = await this.post<IgdbExternalGame>(
      EXTERNAL_GAMES_URL,
      `fields uid, game; where external_game_source = 1 & uid = (${list}); limit 500;`,
    );
    for (const row of rows) {
      if (row.uid && row.game && !found.has(row.uid)) found.set(row.uid, row.game);
    }
    return found;
  }

  private games(body: string): Promise<IgdbGame[]> {
    return this.post<IgdbGame>(GAMES_URL, body);
  }

  private async post<T>(url: string, body: string, retried = false): Promise<T[]> {
    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Client-ID': this.options.clientId,
        Authorization: `Bearer ${await this.accessToken()}`,
      },
      body,
    });
    if (response.status === 401 && !retried) {
      this.token = null;
      return this.post<T>(url, body, true);
    }
    if (!response.ok) {
      throw new HttpError(`Request failed (${response.status}) for ${url}`, response.status);
    }
    return (await response.json()) as T[];
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now() + 60_000) return this.token.value;
    const url = new URL(AUTH_URL);
    url.searchParams.set('client_id', this.options.clientId);
    url.searchParams.set('client_secret', this.options.clientSecret);
    url.searchParams.set('grant_type', 'client_credentials');
    const response = await this.fetchFn(url, { method: 'POST' });
    if (!response.ok) {
      throw new HttpError(`IGDB authentication failed (${response.status})`, response.status);
    }
    const auth = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!auth.access_token) throw new Error('IGDB authentication returned no token');
    this.token = {
      value: auth.access_token,
      expiresAt: this.now() + (auth.expires_in ?? 0) * 1000,
    };
    return this.token.value;
  }
}
