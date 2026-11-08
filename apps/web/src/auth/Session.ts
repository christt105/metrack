import { shallowRef } from 'vue';
import type { AccountDeletion, User } from '@metrack/domain';
import type { ApiClient } from '../api/ApiClient';

/** Who is signed in. The server is asked once; sign-in, sign-out and a refused call update it. */
export class Session {
  readonly user = shallowRef<User | null>(null);
  /** The deletion waiting for the signed-in user, to warn them and let them cancel it. */
  readonly deletion = shallowRef<AccountDeletion | null>(null);
  private known = false;

  constructor(private readonly api: ApiClient) {}

  async current(): Promise<User | null> {
    if (!this.known) {
      this.user.value = await this.api.me();
      this.known = true;
      await this.refreshDeletion();
    }
    return this.user.value;
  }

  signedIn(user: User): void {
    this.user.value = user;
    this.known = true;
    void this.refreshDeletion();
  }

  /** Asks the server whether the signed-in user has a deletion waiting. A failure leaves it unknown. */
  async refreshDeletion(): Promise<void> {
    if (this.user.value === null) {
      this.deletion.value = null;
      return;
    }
    try {
      this.deletion.value = (await this.api.accountStatus()).deletion;
    } catch {
      this.deletion.value = null;
    }
  }

  setDeletion(deletion: AccountDeletion | null): void {
    this.deletion.value = deletion;
  }

  async signOut(): Promise<void> {
    await this.api.logout();
    this.forget();
  }

  /** Drops the user without asking the server, after it refused a call. */
  forget(): void {
    this.user.value = null;
    this.deletion.value = null;
    this.known = true;
  }
}
