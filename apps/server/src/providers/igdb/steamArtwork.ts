const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps';

/** Official Steam library artwork for an app: the 600x900 cover and the wide hero. */
export function steamArtwork(appId: string): { cover: string; banner: string } {
  return {
    cover: `${STEAM_CDN}/${appId}/library_600x900_2x.jpg`,
    banner: `${STEAM_CDN}/${appId}/library_hero.jpg`,
  };
}
