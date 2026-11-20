import type { IsolationSelfWrite } from './IsolationSelfWrite.js';
import { solidImage } from './sampleImages.js';

/** Writes without ids that only touch the caller's own data; user 1's data must stay as it was. */
export const ISOLATION_SELF_WRITES: Readonly<Record<string, IsolationSelfWrite>> = {
  'POST /api/tokens': {
    payload: { name: 'U2 token', scope: 'read', expiresInDays: null },
    statuses: [201],
  },
  'POST /api/images': {
    payload: await solidImage(8, 8, 'png', { r: 1, g: 2, b: 3 }),
    contentType: 'image/png',
    statuses: [201],
  },
  'POST /api/movies': { payload: { title: 'U2 movie' }, statuses: [201] },
  'POST /api/series': { payload: { title: 'U2 series' }, statuses: [201] },
  'POST /api/games': { payload: { title: 'U2 game' }, statuses: [201] },
  'POST /api/books': { payload: { title: 'U2 book' }, statuses: [201] },
  'POST /api/titles': { payload: { type: 'movie', externalId: '603' }, statuses: [201] },
  'POST /api/account/welcome': {
    payload: { name: 'Friend', handle: 'friend' },
    statuses: [200, 409],
  },
  'POST /api/account/deletion': { payload: { confirm: 'delete' }, statuses: [200, 201] },
  'DELETE /api/account/deletion': { statuses: [200] },
  'PATCH /api/settings': { payload: { language: 'en' }, statuses: [200] },
  'PATCH /api/settings/public-page': { payload: { intro: 'U2 intro' }, statuses: [200] },
  'POST /api/settings/ntfy-topic': { statuses: [200, 201] },
  'DELETE /api/settings/ntfy-topic': { statuses: [200, 204] },
  'POST /api/steam/apply': { payload: { appIds: ['1'] }, statuses: [501] },
  'POST /api/steam/artwork': { payload: {}, statuses: [501] },
  'POST /api/sync/apply': { payload: { confirm: true }, statuses: [501] },
};
