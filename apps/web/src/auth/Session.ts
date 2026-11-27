import { shallowRef } from 'vue';
import type { AccountDeletion, Language, PublicPage, User } from '@metrack/domain';
import type { ApiClient } from '../api/ApiClient';

/** Who is signed in. The server is asked once; sign-in, sign-out and a refused call update it. */
export class Session {
  readonly user = shallowRef<User | null>(null);
  /** The deletion waiting for the signed-in user, to warn them and let them cancel it. */
  readonly deletion = shallowRef<AccountDeletion | null>(null);
  /** True until a user who joined by invitation confirms their name and handle. */
  readonly needsWelcome = shallowRef(false);
  /** The signed-in user's own public page settings, or null while unknown or signed out. */
  readonly publicPage = shallowRef<PublicPage | null>(null);
  /** The interface language the signed-in user chose, or null to follow the browser. */
  readonly language = shallowRef<Language | null>(null);
  /** True when the signed-in user has a Jellyfin account set, the only source of unlinked titles. */
  readonly jellyfinLinked = shallowRef(false);
  private known = false;

  constructor(private readonly api: ApiClient) {}

  async current(): Promise<User | null> {
    if (!this.known) {
      this.user.value = await this.api.auth.me();
      this.known = true;
      await this.refreshDeletion();
      void this.refreshPublicPage();
    }
    return this.user.value;
  }

  signedIn(user: User): void {
    this.user.value = user;
    this.known = true;
    void this.refreshDeletion();
    void this.refreshPublicPage();
  }

  /** Asks the server whether the signed-in user has a deletion waiting. A failure leaves it unknown. */
  async refreshDeletion(): Promise<void> {
    if (this.user.value === null) {
      this.deletion.value = null;
      this.needsWelcome.value = false;
      return;
    }
    try {
      const status = await this.api.account.accountStatus();
      this.deletion.value = status.deletion;
      this.needsWelcome.value = status.needsWelcome;
    } catch {
      this.deletion.value = null;
      this.needsWelcome.value = false;
    }
  }

  /** Asks the server for the user's public page and language. A failure leaves them unknown. */
  async refreshPublicPage(): Promise<void> {
    if (this.user.value === null) {
      this.publicPage.value = null;
      this.language.value = null;
      this.jellyfinLinked.value = false;
      return;
    }
    try {
      const own = await this.api.settings.ownSettings();
      this.publicPage.value = own.publicPage;
      this.language.value = own.settings.language;
      this.jellyfinLinked.value = Boolean(own.settings.jellyfinUser);
    } catch {
      this.publicPage.value = null;
    }
  }

  setLanguage(language: Language | null): void {
    this.language.value = language;
  }

  setPublicPage(page: PublicPage | null): void {
    this.publicPage.value = page;
  }

  /** Records the user as they confirmed themselves on first entry. */
  welcomed(user: User): void {
    this.user.value = user;
    this.needsWelcome.value = false;
    void this.refreshPublicPage();
  }

  setDeletion(deletion: AccountDeletion | null): void {
    this.deletion.value = deletion;
  }

  async signOut(): Promise<void> {
    await this.api.auth.logout();
    this.forget();
  }

  /** Drops the user without asking the server, after it refused a call. */
  forget(): void {
    this.user.value = null;
    this.deletion.value = null;
    this.publicPage.value = null;
    this.language.value = null;
    this.jellyfinLinked.value = false;
    this.needsWelcome.value = false;
    this.known = true;
  }
}
