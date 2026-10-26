/** The fields of an IGDB `games` record that metrack asks for. Image urls are protocol-relative thumbnails. */
export interface IgdbGame {
  id: number;
  name?: string;
  first_release_date?: number;
  summary?: string;
  storyline?: string;
  cover?: { url?: string };
  screenshots?: { url?: string }[];
  genres?: { name?: string }[];
  platforms?: { name?: string }[];
  involved_companies?: { developer?: boolean; company?: { name?: string } }[];
  external_games?: { external_game_source?: number; uid?: string }[];
}
