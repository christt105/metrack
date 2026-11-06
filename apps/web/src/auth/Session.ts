import { shallowRef } from 'vue';
import type { User } from '@metrack/domain';
import type { ApiClient } from '../api/ApiClient';

/** Who is signed in. The server is asked once; sign-in, sign-out and a refused call update it. */
export class Session {
  readonly user = shallowRef<User | null>(null);
  private known = false;

  constructor(private readonly api: ApiClient) {}

  async current(): Promise<User | null> {
    if (!this.known) {
      this.user.value = await this.api.me();
      this.known = true;
    }
    return this.user.value;
  }

  signedIn(user: User): void {
    this.user.value = user;
    this.known = true;
  }

  async signOut(): Promise<void> {
    await this.api.logout();
    this.forget();
  }

  /** Drops the user without asking the server, after it refused a call. */
  forget(): void {
    this.user.value = null;
    this.known = true;
  }
}
