import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../src/api/ApiClient';
import { Session } from '../src/auth/Session';
import { EMPTY_PAGE } from './EMPTY_PAGE';

const user = { id: 1, name: 'U', email: null, role: 'normal' } as const;

describe('Session language', () => {
  it('takes the language from the signed-in user settings and forgets it on sign-out', async () => {
    const api = {
      accountStatus: vi.fn().mockResolvedValue({ deletion: null, needsWelcome: false }),
      ownSettings: vi.fn().mockResolvedValue({
        settings: { language: 'en' },
        publicPage: EMPTY_PAGE,
        owner: false,
        ntfyTopicGenerated: false,
      }),
    } as unknown as ApiClient;
    const session = new Session(api);
    session.signedIn(user);
    await session.refreshPublicPage();
    expect(session.language.value).toBe('en');
    session.forget();
    expect(session.language.value).toBeNull();
  });
});
