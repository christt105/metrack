import { beforeEach, describe, expect, it } from 'vitest';
import type { User } from '@metrack/domain';
import type { Authenticator } from '../src/auth/Authenticator.js';
import { emptyMovie, emptySeason, emptySeries } from '../src/media/emptyEntities.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';
import { pathFetch } from './support/pathFetch.js';
import { solidImage } from './support/sampleImages.js';

const OWNER: User = { id: 1, name: 'Owner', email: null, role: 'owner' };
const FRIEND: User = { id: 2, name: 'Friend', email: null, role: 'trusted' };
const TMDB_COVER = 'https://image.tmdb.org/t/p/original/dune.jpg';

const byHeader: Authenticator = {
  userFor: async (headers) => [OWNER, FRIEND].find((u) => u.id === Number(headers['x-test-user'])),
};

let api: TestApi;
let scope: AsyncUserScope;

beforeEach(async () => {
  scope = new AsyncUserScope();
  api = await createTestApi(pathFetch({}).fetch, { scope, authenticator: byHeader });
  await new SqliteUserRepository(api.db).create({ name: FRIEND.name, email: null });
  api.db.prepare("UPDATE user SET role = 'trusted' WHERE id = 2").run();
});

const as = (user: User) => ({
  get: (url: string) =>
    api.app.inject({ method: 'GET', url, headers: { 'x-test-user': String(user.id) } }),
  patch: (url: string, payload: object) =>
    api.app.inject({
      method: 'PATCH',
      url,
      payload,
      headers: { 'x-test-user': String(user.id) },
    }),
});
const owner = as(OWNER);
const friend = as(FRIEND);
const visitor = (url: string) => api.app.inject({ method: 'GET', url });

async function publish(user: User, handle: string): Promise<void> {
  const response = await as(user).patch('/api/settings/public-page', { handle, enabled: true });
  expect(response.statusCode).toBe(200);
}

async function addMovie(user: User, fields: Record<string, unknown>): Promise<number> {
  const movie = await scope.run(user.id, () =>
    api.movies.create({ ...emptyMovie(), ...fields } as ReturnType<typeof emptyMovie>),
  );
  return movie.id;
}

describe('the public page settings', () => {
  it('start off, without a handle', async () => {
    expect((await owner.get('/api/settings')).json().publicPage).toEqual({
      handle: null,
      enabled: false,
    });
  });

  it('turn on with a handle, stored in lowercase', async () => {
    const response = await owner.patch('/api/settings/public-page', {
      handle: 'Christian',
      enabled: true,
    });
    expect(response.json()).toEqual({ handle: 'christian', enabled: true });
    expect((await owner.get('/api/settings')).json().publicPage).toEqual({
      handle: 'christian',
      enabled: true,
    });
  });

  it('refuse to turn on without a handle', async () => {
    const response = await owner.patch('/api/settings/public-page', { enabled: true });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('handle_required');
  });

  it('refuse to clear the handle while on', async () => {
    await publish(OWNER, 'christian');
    const response = await owner.patch('/api/settings/public-page', { handle: null });
    expect(response.json().code).toBe('handle_required');
    const off = await owner.patch('/api/settings/public-page', { handle: null, enabled: false });
    expect(off.json()).toEqual({ handle: null, enabled: false });
  });

  it.each(['ab', 'Bad_Name', 'with space', 'admin', 'a'.repeat(31)])(
    'refuse the handle %s',
    async (handle) => {
      const response = await owner.patch('/api/settings/public-page', { handle });
      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('invalid_handle');
    },
  );

  it('refuse a handle another user has, whatever the case', async () => {
    await publish(OWNER, 'christian');
    const response = await friend.patch('/api/settings/public-page', { handle: 'CHRISTIAN' });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe('handle_taken');
    expect((await friend.get('/api/settings')).json().publicPage.handle).toBeNull();
  });

  it('let the owner of a handle change it and keep their other settings', async () => {
    await publish(OWNER, 'christian');
    await publish(OWNER, 'christian');
    const renamed = await owner.patch('/api/settings/public-page', { handle: 'chris' });
    expect(renamed.json()).toEqual({ handle: 'chris', enabled: true });
    expect((await visitor('/u/christian/')).statusCode).toBe(404);
    expect((await visitor('/u/chris/')).statusCode).toBe(200);
  });

  it('survive saving the other settings', async () => {
    await publish(OWNER, 'christian');
    await api.app.inject({
      method: 'PATCH',
      url: '/api/users/1/settings',
      payload: { ntfyTopic: 'topic' },
      headers: { 'x-test-user': '1' },
    });
    expect((await owner.get('/api/settings')).json().publicPage.enabled).toBe(true);
  });

  it('are not reachable with an API token or without signing in', async () => {
    const response = await visitor('/api/settings/public-page');
    expect(response.statusCode).toBe(404);
    const patched = await api.app.inject({
      method: 'PATCH',
      url: '/api/settings/public-page',
      payload: { handle: 'abc' },
    });
    expect(patched.statusCode).toBe(401);
  });
});

describe('the public routes', () => {
  it('answer the same 404 for a missing user, a page that is off and no handle', async () => {
    await owner.patch('/api/settings/public-page', { handle: 'christian' });
    const off = await visitor('/u/christian/');
    const missing = await visitor('/u/nobody/');
    expect(off.statusCode).toBe(404);
    expect(missing.statusCode).toBe(404);
    expect(off.body).toBe(missing.body);
    expect(off.headers['x-robots-tag']).toBe('noindex');
    for (const path of ['feed.xml', 'movie/1', 'images/' + 'a'.repeat(64)]) {
      const a = await visitor(`/u/christian/${path}`);
      const b = await visitor(`/u/nobody/${path}`);
      expect([a.statusCode, b.statusCode]).toEqual([404, 404]);
      expect(a.body).toBe(b.body);
    }
  });

  it('serve the home without signing in, with noindex in header and page', async () => {
    await publish(OWNER, 'christian');
    await addMovie(OWNER, { title: 'Dune', status: 'completed', finishedAt: '2026-03-05' });
    const response = await visitor('/u/christian/');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.headers['x-robots-tag']).toBe('noindex');
    expect(response.body).toContain('<meta name="robots" content="noindex">');
    expect(response.body).toContain('Dune');
    expect((await visitor('/u/Christian')).statusCode).toBe(200);
  });

  it('serve the stylesheet with noindex', async () => {
    const response = await visitor('/u/assets/site.css');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/css');
    expect(response.headers['x-robots-tag']).toBe('noindex');
  });

  it('keep every /api route closed', async () => {
    await publish(OWNER, 'christian');
    expect((await visitor('/api/media')).statusCode).toBe(401);
    expect((await visitor('/api/settings')).statusCode).toBe(401);
  });

  it('send noindex with unknown paths below /u', async () => {
    const response = await visitor('/u/christian/a/b/c/d');
    expect(response.statusCode).toBe(404);
    expect(response.headers['x-robots-tag']).toBe('noindex');
  });

  it('show detail pages by id, and 404 for anything else', async () => {
    await publish(OWNER, 'christian');
    const id = await addMovie(OWNER, {
      title: 'Dune',
      status: 'completed',
      finishedAt: '2026-03-05',
      rating: 6,
      review: 'Muy **buena**',
    });
    const page = await visitor(`/u/christian/movie/${id}`);
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('<strong>buena</strong>');
    expect(page.body).toContain('Increíble');
    expect((await visitor(`/u/christian/movie/${id + 1}`)).statusCode).toBe(404);
    expect((await visitor(`/u/christian/film/${id}`)).statusCode).toBe(404);
    expect((await visitor('/u/christian/movie/abc')).statusCode).toBe(404);
  });

  it('show a series with its seasons', async () => {
    await publish(OWNER, 'christian');
    const { seriesId, seasonId } = await scope.run(OWNER.id, async () => {
      const show = await api.series.create({ ...emptySeries(), title: 'Lupin' });
      const part = await api.seasons.create({
        ...emptySeason(),
        seriesId: show.id,
        number: 1,
        status: 'completed',
        finishedAt: '2026-01-10',
      });
      return { seriesId: show.id, seasonId: part.id };
    });
    const page = await visitor(`/u/christian/series/${seriesId}`);
    expect(page.body).toContain(`/u/christian/season/${seasonId}`);
    expect((await visitor(`/u/christian/season/${seasonId}`)).body).toContain(
      `/u/christian/series/${seriesId}`,
    );
  });

  it('never show an item pending review, on the home, the feed or its own page', async () => {
    await publish(OWNER, 'christian');
    await addMovie(OWNER, { title: 'Visible', status: 'completed', finishedAt: '2026-03-05' });
    const hidden = await addMovie(OWNER, {
      title: 'Secret viewing',
      status: 'completed',
      finishedAt: '2026-04-01',
      pendingReview: true,
    });
    const home = await visitor('/u/christian/');
    const feed = await visitor('/u/christian/feed.xml');
    expect(home.body).toContain('Visible');
    expect(home.body).not.toContain('Secret viewing');
    expect(feed.body).not.toContain('Secret viewing');
    expect((await visitor(`/u/christian/movie/${hidden}`)).statusCode).toBe(404);
  });

  it('never show another user’s items', async () => {
    await publish(OWNER, 'christian');
    await publish(FRIEND, 'friend');
    const mine = await addMovie(OWNER, { title: 'Mine' });
    const theirs = await addMovie(FRIEND, {
      title: 'Theirs',
      status: 'completed',
      finishedAt: '2026-02-02',
    });
    expect(mine).not.toBe(theirs);
    const home = await visitor('/u/christian/');
    expect(home.body).toContain('Mine');
    expect(home.body).not.toContain('Theirs');
    const feed = await visitor('/u/christian/feed.xml');
    expect(feed.body).not.toContain('Theirs');
    expect((await visitor('/u/friend/')).body).not.toContain('Mine');
    const crossed = await visitor(`/u/friend/movie/${mine}`);
    expect(crossed.statusCode).toBe(404);
    expect((await visitor(`/u/friend/movie/${theirs}`)).body).toContain('Theirs');
  });

  it('serve a feed of finished items, newest first, with stable guids and confirmed reviews', async () => {
    await publish(OWNER, 'christian');
    const old = await addMovie(OWNER, {
      title: 'Old',
      status: 'completed',
      finishedAt: '2026-01-01',
    });
    const recent = await addMovie(OWNER, {
      title: 'Recent',
      status: 'completed',
      finishedAt: '2026-05-01',
      review: 'Reseña confirmada',
      cover: TMDB_COVER,
    });
    await addMovie(OWNER, { title: 'Pending', status: 'in_progress' });
    const response = await api.app.inject({
      method: 'GET',
      url: '/u/christian/feed.xml',
      headers: { host: 'metrack.example', 'x-forwarded-proto': 'https' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/rss+xml');
    expect(response.headers['x-robots-tag']).toBe('noindex');
    const titles = [...response.body.matchAll(/<item>\s*<title>(.*?)<\/title>/g)].map((m) => m[1]);
    expect(titles).toEqual(['Recent', 'Old']);
    expect(response.body).toContain(
      `<guid isPermaLink="false">metrack:christian:movie:${recent}:2026-05-01</guid>`,
    );
    expect(response.body).toContain(
      `<guid isPermaLink="false">metrack:christian:movie:${old}:2026-01-01</guid>`,
    );
    expect(response.body).toContain(
      `<link>https://metrack.example/u/christian/movie/${recent}</link>`,
    );
    expect(response.body).toContain('Reseña confirmada');
    expect(response.body).toContain('/t/p/w342/dune.jpg');
  });

  it('links the feed to PUBLIC_URL when configured, whatever the visitor used', async () => {
    await api.app.close();
    api = await createTestApi(pathFetch({}).fetch, {
      scope,
      authenticator: byHeader,
      publicUrl: 'https://public.example/',
    });
    await publish(OWNER, 'christian');
    const id = await addMovie(OWNER, {
      title: 'Recent',
      status: 'completed',
      finishedAt: '2026-05-01',
    });
    const response = await api.app.inject({
      method: 'GET',
      url: '/u/christian/feed.xml',
      headers: { host: 'metrack.example', 'x-forwarded-proto': 'https' },
    });
    expect(response.body).toContain(`<link>https://public.example/u/christian/movie/${id}</link>`);
    expect(response.body).not.toContain('metrack.example');
  });
});

describe('the public images', () => {
  const uploadAs = async (userId: number, shade: number) =>
    api.store.upload(
      new Uint8Array(await solidImage(30, 45, 'png', { r: shade, g: 40, b: 90 })),
      userId,
    );
  async function upload(user: User): Promise<string> {
    return (await uploadAs(user.id, 7)).ref.slice('/api/images/'.length);
  }

  it('show an owner’s cover and a review image to anyone, only on their enabled page', async () => {
    await publish(OWNER, 'christian');
    const cover = await upload(OWNER);
    const embedded = await uploadAs(OWNER.id, 8);
    const embeddedHash = embedded.ref.slice('/api/images/'.length);
    await addMovie(OWNER, {
      title: 'Dune',
      status: 'completed',
      finishedAt: '2026-03-05',
      cover: `/api/images/${cover}`,
      review: `Mira\n\n![foto](${embedded.ref})`,
    });
    const home = await visitor('/u/christian/');
    expect(home.body).toContain(`/u/christian/images/${cover}`);
    const image = await visitor(`/u/christian/images/${cover}`);
    expect(image.statusCode).toBe(200);
    expect(image.headers['content-type']).toBe('image/webp');
    expect(image.headers['x-robots-tag']).toBe('noindex');
    expect((await visitor(`/u/christian/images/${embeddedHash}`)).statusCode).toBe(200);
    expect((await visitor(`/api/images/${cover}`)).statusCode).toBe(401);
  });

  it('keep other images private: unpublished, pending or another user’s', async () => {
    await publish(OWNER, 'christian');
    await publish(FRIEND, 'friend');
    const unused = await upload(OWNER);
    const pendingCover = (await uploadAs(OWNER.id, 9)).ref;
    await addMovie(OWNER, { title: 'Hidden', pendingReview: true, cover: pendingCover });
    const friendsCover = (await uploadAs(FRIEND.id, 10)).ref;
    await addMovie(FRIEND, { title: 'Theirs', cover: friendsCover });
    expect((await visitor(`/u/christian/images/${unused}`)).statusCode).toBe(404);
    expect(
      (await visitor(`/u/christian/images/${pendingCover.slice('/api/images/'.length)}`))
        .statusCode,
    ).toBe(404);
    const theirHash = friendsCover.slice('/api/images/'.length);
    expect((await visitor(`/u/christian/images/${theirHash}`)).statusCode).toBe(404);
    expect((await visitor(`/u/friend/images/${theirHash}`)).statusCode).toBe(200);
  });

  it('stop being served when the page is switched off', async () => {
    await publish(OWNER, 'christian');
    const cover = await upload(OWNER);
    await addMovie(OWNER, { title: 'Dune', cover: `/api/images/${cover}` });
    expect((await visitor(`/u/christian/images/${cover}`)).statusCode).toBe(200);
    await owner.patch('/api/settings/public-page', { enabled: false });
    expect((await visitor(`/u/christian/images/${cover}`)).statusCode).toBe(404);
  });
});
