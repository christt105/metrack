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
    expect(response.body).toContain('<html lang="es" class="dark">');
    expect((await api.app.inject({ method: 'GET', url: '/api/account' })).statusCode).toBe(401);
  });

  it('states the retention, the contact and the required TMDB notice', async () => {
    const api = await createTestApi(fakeFetch({}).fetch);
    const { body } = await api.app.inject({
      method: 'GET',
      url: '/privacy',
      headers: { 'accept-language': 'en-US,en;q=0.9' },
    });
    expect(body).toContain(
      'This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.',
    );
    expect(body).toContain('privacy@example.test');
    expect(body).toContain('7 days');
    expect(body).toContain('14 on the second disk');
    for (const credit of ['IGDB', 'Twitch', 'Open Library', 'SteamGridDB', 'Steam', 'TheTVDB']) {
      expect(body).toContain(credit);
    }
    expect(body).toContain('/api/account/export');
  });

  it('follows the visitor: Spanish by default and for Spanish browsers, English when asked first', async () => {
    const api = await createTestApi(fakeFetch({}).fetch);
    const ask = async (headers: Record<string, string>) =>
      api.app.inject({ method: 'GET', url: '/privacy', headers });
    const none = await ask({});
    expect(none.body).toContain('<html lang="es" class="dark">');
    expect(none.body).toContain('<h1>Privacidad</h1>');
    expect(none.body).toContain('privacy@example.test');
    const spanish = await ask({ 'accept-language': 'es-ES,es;q=0.9,en;q=0.8' });
    expect(spanish.body).toContain('<h1>Privacidad</h1>');
    const english = await ask({ 'accept-language': 'en-US,en;q=0.9' });
    expect(english.body).toContain('<html lang="en" class="dark">');
    expect(english.body).toContain('<h1>Privacy</h1>');
    const french = await ask({ 'accept-language': 'fr-FR,fr;q=0.9' });
    expect(french.body).toContain('<h1>Privacidad</h1>');
  });

  it('says what it stores from Google sign-in in both languages', async () => {
    const api = await createTestApi(fakeFetch({}).fetch);
    const english = await api.app.inject({
      method: 'GET',
      url: '/privacy',
      headers: { 'accept-language': 'en' },
    });
    expect(english.body).toContain(
      'the email address Google verified for your Google account is stored',
    );
    const spanish = await api.app.inject({ method: 'GET', url: '/privacy' });
    expect(spanish.body).toContain('la dirección de correo que Google verificó');
    expect(spanish.body).toContain('el identificador de tu cuenta de Google');
  });

  it('is never shared between languages by a cache', async () => {
    const api = await createTestApi(fakeFetch({}).fetch);
    for (const headers of [{}, { 'accept-language': 'en' }] as Record<string, string>[]) {
      const response = await api.app.inject({ method: 'GET', url: '/privacy', headers });
      expect(response.headers['vary']).toBe('Accept-Language');
      expect(response.headers['cache-control']).toBe('private, max-age=300');
    }
  });

  it('answers a missing public address in the visitor language, varying by it', async () => {
    const api = await createTestApi(fakeFetch({}).fetch);
    const spanish = await api.app.inject({ method: 'GET', url: '/u/nobody/' });
    expect(spanish.statusCode).toBe(404);
    expect(spanish.body).toContain('Esta página no existe.');
    expect(spanish.headers['vary']).toBe('Accept-Language');
    const english = await api.app.inject({
      method: 'GET',
      url: '/u/nobody/',
      headers: { 'accept-language': 'en-GB' },
    });
    expect(english.body).toContain('This page does not exist.');
    expect(english.headers['vary']).toBe('Accept-Language');
  });
});
