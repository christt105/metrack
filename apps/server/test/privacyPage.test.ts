import { describe, expect, it } from 'vitest';
import { createTestApi } from './support/createTestApi.js';
import { fakeFetch } from './support/fakeFetch.js';

describe('privacy page', () => {
  it('is public: it answers with no session at all', async () => {
    const api = await createTestApi(fakeFetch({}).fetch, {
      authenticator: { userFor: async () => undefined },
    });
    const response = await api.app.inject({ method: 'GET', url: '/privacy' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('<html lang="en" class="dark">');
    expect((await api.app.inject({ method: 'GET', url: '/api/account' })).statusCode).toBe(401);
  });

  it('states the retention, the contact and the required TMDB notice', async () => {
    const api = await createTestApi(fakeFetch({}).fetch);
    const { body } = await api.app.inject({ method: 'GET', url: '/privacy' });
    expect(body).toContain(
      'This product uses the TMDB API but is not endorsed or certified by TMDB.',
    );
    expect(body).toContain('privacy@example.test');
    expect(body).toContain('7 days');
    expect(body).toContain('14 on the second disk');
    for (const credit of ['IGDB', 'Twitch', 'Open Library', 'SteamGridDB', 'Steam', 'TheTVDB']) {
      expect(body).toContain(credit);
    }
    expect(body).toContain('/api/account/export');
  });
});
