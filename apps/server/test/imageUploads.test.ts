import { beforeEach, describe, expect, it } from 'vitest';
import type { Authenticator } from '../src/auth/Authenticator.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';
import { fakeFetch } from './support/fakeFetch.js';
import { noiseImage, solidImage } from './support/sampleImages.js';

const PUBLIC_IMAGE = 'https://pics.test/cover.png';

let api: TestApi;
let users: SqliteUserRepository;

const byHeader: Authenticator = {
  userFor: async (headers) => users.get(Number(headers.get('x-test-user'))),
};

beforeEach(async () => {
  api = await createTestApi(fakeFetch({ [PUBLIC_IMAGE]: await solidImage(200, 300) }).fetch, {
    scope: new AsyncUserScope(),
    authenticator: byHeader,
    images: { quotaBytes: 4000 },
  });
  users = new SqliteUserRepository(api.db);
  await users.create({ name: 'Trusted', email: null });
  await users.create({ name: 'Normal', email: null });
  await users.setRole(2, 'trusted');
});

function as(userId: number) {
  const headers = { 'x-test-user': String(userId) };
  return {
    get: (url: string) => api.app.inject({ method: 'GET', url, headers }),
    put: (url: string, payload: object) => api.app.inject({ method: 'PUT', url, headers, payload }),
    post: (url: string, payload: object) =>
      api.app.inject({ method: 'POST', url, headers, payload }),
    upload: (body: Buffer, type = 'image/png') =>
      api.app.inject({
        method: 'POST',
        url: '/api/images',
        headers: { ...headers, 'content-type': type },
        payload: body,
      }),
  };
}

const owner = as(1);
const trusted = as(2);
const normal = as(3);

describe('uploading images', () => {
  it('stores a trusted user’s upload as WebP and reports their usage', async () => {
    const response = await trusted.upload(await solidImage(40, 30, 'jpeg'), 'image/jpeg');
    expect(response.statusCode).toBe(201);
    const uploaded = response.json();
    expect(uploaded).toMatchObject({ mimeType: 'image/webp', width: 40, height: 30 });
    expect(uploaded.usage).toEqual({ usedBytes: uploaded.byteSize, quotaBytes: 4000 });
    expect((await trusted.get('/api/images/usage')).json()).toEqual(uploaded.usage);
    expect((await normal.get('/api/images/usage')).json().usedBytes).toBe(0);
  });

  it('refuses uploads to normal users', async () => {
    const response = await normal.upload(await solidImage(40, 30));
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe('trusted_only');
    expect(await api.store.list()).toEqual([]);
  });

  it('gives the owner no quota, however much they upload', async () => {
    const first = (await owner.upload(await noiseImage(128, 128))).json();
    expect(first.usage).toEqual({ usedBytes: first.byteSize, quotaBytes: null });
    expect(first.byteSize).toBeGreaterThan(4000);
    const second = await owner.upload(await noiseImage(129, 129));
    expect(second.statusCode).toBe(201);
    const usage = (await owner.get('/api/images/usage')).json();
    expect(usage.quotaBytes).toBeNull();
    expect(usage.usedBytes).toBeGreaterThan(8000);
  });

  it('answers each refusal with its own code', async () => {
    expect((await trusted.upload(Buffer.from('<html>'))).json().code).toBe('unsupported_image');
    const small = await trusted.upload(await solidImage(64, 64), 'application/octet-stream');
    expect(small.statusCode).toBe(201);
    const last = await trusted.upload(await noiseImage(128, 128));
    expect(last.statusCode).toBe(409);
    expect(last.json().code).toBe('image_quota_exceeded');
  });

  it('refuses a file over the upload limit before reading it', async () => {
    api = await createTestApi(fakeFetch({}).fetch, { images: { maxUploadBytes: 2000 } });
    const response = await api.app.inject({
      method: 'POST',
      url: '/api/images',
      headers: { 'content-type': 'image/png' },
      payload: await noiseImage(64, 64),
    });
    expect(response.statusCode).toBe(413);
    expect(response.json().code).toBe('body_too_large');
    expect(await api.store.list()).toEqual([]);
  });

  it('keeps someone’s own image away from everyone else', async () => {
    const { ref } = (await trusted.upload(await solidImage(10, 10))).json();
    expect((await trusted.get(ref)).statusCode).toBe(200);
    expect((await normal.get(ref)).statusCode).toBe(404);
    expect((await owner.get(ref)).statusCode).toBe(200);
  });
});

describe('own covers and banners', () => {
  it('lets a trusted user set an upload of theirs, never someone else’s', async () => {
    const id = (await owner.post('/api/movies', { title: 'Matrix', tmdbId: 603 })).json().id;
    const mine = (await trusted.upload(await solidImage(20, 30))).json();
    const theirs = (await owner.upload(await solidImage(21, 30))).json();
    api.db.prepare('INSERT INTO movie_entry (user_id, movie_id) VALUES (2, ?), (3, ?)').run(id, id);
    const set = await trusted.put(`/api/movies/${id}/images/cover`, { url: mine.ref });
    expect(set.statusCode).toBe(200);
    expect(set.json().cover).toBe(mine.ref);
    const foreign = await trusted.put(`/api/movies/${id}/images/banner`, { url: theirs.ref });
    expect(foreign.statusCode).toBe(400);
    expect(foreign.json().code).toBe('image_not_found');
    expect((await owner.get(`/api/movies/${id}`)).json().cover).toBeNull();
  });

  it('lets a trusted user copy a URL of any site, counted as theirs', async () => {
    const id = (await owner.post('/api/movies', { title: 'Matrix', tmdbId: 603 })).json().id;
    api.db.prepare('INSERT INTO movie_entry (user_id, movie_id) VALUES (2, ?)').run(id);
    const set = await trusted.put(`/api/movies/${id}/images/cover`, { url: PUBLIC_IMAGE });
    expect(set.statusCode).toBe(200);
    expect(set.json().cover).toMatch(/^\/api\/images\//);
    expect((await trusted.get('/api/images/usage')).json().usedBytes).toBeGreaterThan(0);
  });

  it('refuses own covers to normal users', async () => {
    const id = (await owner.post('/api/movies', { title: 'Matrix', tmdbId: 603 })).json().id;
    api.db.prepare('INSERT INTO movie_entry (user_id, movie_id) VALUES (3, ?)').run(id);
    const upload = (await trusted.upload(await solidImage(20, 30))).json();
    for (const url of [upload.ref, PUBLIC_IMAGE]) {
      const response = await normal.put(`/api/movies/${id}/images/cover`, { url });
      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe('trusted_only');
    }
    expect((await normal.get('/api/images/usage')).json().usedBytes).toBe(0);
  });
});
