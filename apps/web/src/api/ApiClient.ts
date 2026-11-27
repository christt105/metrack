import { HttpTransport } from './HttpTransport';
import { recodeToWebp } from '../logic/recodeToWebp';
import { AuthApi } from './areas/AuthApi';
import { LibraryApi } from './areas/LibraryApi';
import { SeasonsApi } from './areas/SeasonsApi';
import { ImagesApi } from './areas/ImagesApi';
import { FollowingApi } from './areas/FollowingApi';
import { SettingsApi } from './areas/SettingsApi';
import { SteamApi } from './areas/SteamApi';
import { AccountApi } from './areas/AccountApi';
import { AdminApi } from './areas/AdminApi';

/**
 * Typed access to the private editing API. The fetch function is injected so tests can fake the network.
 * `onUnauthenticated` runs when a call outside `/auth` is refused for lack of a session.
 */
export class ApiClient {
  readonly auth: AuthApi;
  readonly library: LibraryApi;
  readonly seasons: SeasonsApi;
  readonly images: ImagesApi;
  readonly following: FollowingApi;
  readonly settings: SettingsApi;
  readonly steam: SteamApi;
  readonly account: AccountApi;
  readonly admin: AdminApi;

  constructor(
    fetchFn: typeof fetch = (...args) => fetch(...args),
    onUnauthenticated: () => void = () => {},
    recode: (file: Blob, maxSide: number) => Promise<Blob> = recodeToWebp,
    onReachable: (reachable: boolean) => void = () => {},
  ) {
    const transport = new HttpTransport(fetchFn, onUnauthenticated, onReachable);
    this.auth = new AuthApi(transport);
    this.library = new LibraryApi(transport);
    this.seasons = new SeasonsApi(transport);
    this.images = new ImagesApi(transport, recode);
    this.following = new FollowingApi(transport);
    this.settings = new SettingsApi(transport);
    this.steam = new SteamApi(transport);
    this.account = new AccountApi(transport);
    this.admin = new AdminApi(transport);
  }
}
