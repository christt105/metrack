import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OwnSettings, User, UserSettings, WatchlistEntry } from '@metrack/domain';
import { Locale } from '../src/i18n/Locale';
import { localeKey } from '../src/i18n/localeKey';
import { es } from '../src/i18n/messages/es';
import SettingsView from '../src/views/SettingsView.vue';
import WatchlistView from '../src/views/WatchlistView.vue';
import { EMPTY_PAGE } from './EMPTY_PAGE';
import { mountWithApi } from './mountWithApi';

const spanish = { [localeKey as symbol]: new Locale(['es-ES']) };
const noSettings: UserSettings = {
  jellyfinUser: null,
  ntfyTopic: null,
  mirrorDir: null,
  mirrorLinkPrefix: null,
  language: null,
  steamId: null,
};
const owner: User = { id: 1, name: 'Owner', email: null, role: 'owner' };

afterEach(() => {
  vi.useRealTimers();
});

describe('Spanish dictionary in components', () => {
  it('serves the dictionary for a Spanish browser', () => {
    expect(new Locale(['es-ES']).messages).toBe(es);
  });

  it('renders the settings view in Spanish', async () => {
    const { wrapper } = await mountWithApi(
      SettingsView,
      {
        auth: {
          health: vi.fn().mockResolvedValue({
            status: 'ok',
            appVersion: 'dev',
            schemaVersion: 3,
            features: { backups: true, sync: true, googleLogin: false },
          }),
        },
        ownSettings: vi.fn().mockResolvedValue({
          settings: noSettings,
          publicPage: EMPTY_PAGE,
          owner: true,
          ntfyTopicGenerated: false,
        } satisfies OwnSettings),
        listUsers: vi.fn().mockResolvedValue([{ user: owner, settings: noSettings }]),
        listBackups: vi.fn().mockResolvedValue([]),
      },
      {},
      spanish,
    );
    await flushPromises();
    expect(wrapper.text()).toContain('Ajustes');
    expect(wrapper.text()).toContain('Copias de seguridad');
    expect(wrapper.text()).toContain('Aún no hay copias.');
    expect(wrapper.text()).not.toContain('No backups yet.');
  });

  it('renders the following agenda in Spanish', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 12));
    const show: WatchlistEntry = {
      type: 'series',
      id: 3,
      title: 'Lupin',
      cover: null,
      banner: null,
      nextEpisode: { seasonNumber: 4, episodeNumber: 2, airDate: '2026-11-17', name: 'The Heist' },
      releaseDate: null,
    };
    const premiere: WatchlistEntry = {
      ...show,
      id: 8,
      type: 'movie',
      title: 'Heat 2',
      nextEpisode: null,
      releaseDate: '2026-12-25',
    };
    const { wrapper } = await mountWithApi(
      WatchlistView,
      {
        listWatchlist: vi.fn().mockResolvedValue([show, premiere]),
        listAlerts: vi.fn().mockResolvedValue([]),
      },
      {},
      spanish,
    );
    await flushPromises();
    const agenda = wrapper.find('.agenda').text();
    expect(agenda).toContain('Mañana');
    expect(agenda).toContain('T4 · E2 · The Heist');
    expect(agenda).toContain('diciembre de 2026');
    expect(agenda).toContain('Estreno');
  });
});

describe('Spanish dictionary functions', () => {
  it('pluralises counts', () => {
    expect(es.list.count(1)).toBe('1 título');
    expect(es.list.count(3)).toBe('3 títulos');
    expect(es.list.seasons(1)).toBe('1 temporada');
    expect(es.list.seasons(2)).toBe('2 temporadas');
    expect(es.edit.changes(1)).toBe('1 cambio');
    expect(es.edit.changes(4)).toBe('4 cambios');
    expect(es.hero.episodes(0)).toBe('0 episodios');
    expect(es.episodes.watchedTimes(1)).toBe('Visto 1 vez');
    expect(es.episodes.watchedTimes(2)).toBe('Visto 2 veces');
    expect(es.invites.expiryLabel(1)).toBe('1 día');
    expect(es.invites.expiryLabel(7)).toBe('7 días');
    expect(es.unmatched.title(1)).toBe('No se ha podido registrar 1 episodio visto');
    expect(es.unmatched.title(2)).toBe('No se han podido registrar 2 episodios vistos');
    expect(es.settings.cleanupDone(1)).toBe('1 imagen eliminada.');
    expect(es.settings.cleanupDone(5)).toBe('5 imágenes eliminadas.');
    expect(es.account.exportMissing(1)).toContain('1 imagen');
    expect(es.account.exportMissing(2)).toContain('2 imágenes');
    expect(es.settings.syncUnmatched(1, 1)).toContain('1 reproducción de 1 título que ya no está');
    expect(es.settings.syncUnmatched(2, 3)).toContain(
      '2 reproducciones de 3 títulos que ya no están',
    );
  });

  it('words relative days', () => {
    expect(es.watchlist.relative(0)).toBe('Hoy');
    expect(es.watchlist.relative(1)).toBe('Mañana');
    expect(es.watchlist.relative(-1)).toBe('Ayer');
    expect(es.watchlist.relative(3)).toBe('En 3 días');
    expect(es.watchlist.relative(-2)).toBe('Hace 2 días');
    expect(es.watchlist.relative(-30)).toBe('Hace 30 días');
  });

  it('formats dates in es-ES from a fixed date', () => {
    expect(es.episodes.airDate('2026-10-05')).toBe('5 oct 2026');
    expect(es.watchlist.month('2026-10')).toBe('octubre de 2026');
    expect(es.watchlist.day('2026-10-05')).toBe('lunes, 5 de octubre');
    expect(es.watchlist.weekday('2026-10-05')).toBe('lun');
    expect(es.watchlist.monthShort('2026-10-05')).toBe('oct');
  });

  it('starts the calendar week on Monday', () => {
    expect(es.watchlist.weekdays).toEqual(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']);
  });

  it('formats sizes with a decimal comma', () => {
    expect(es.settings.backupSize(2_097_152)).toBe('2,0 MB');
    expect(es.images.megabytes(1_572_864)).toBe('1,5 MB');
  });
});
