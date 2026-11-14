import {
  COLLECTIONS,
  MEDIA_TYPE_OF_COLLECTION,
  type ConnectorSyncRequest,
  type ConnectorSyncResponse,
  type ConnectorSyncState,
  type ConnectorUser,
  type EntityRef,
  type MediaType,
  type RefreshResult,
} from '@metrack/domain';
import type { AlertUser } from '../alerts/AlertUser.js';
import type { FollowedTitle } from '../alerts/FollowedTitle.js';
import type { ReconcileSeasonsRequest } from '../alerts/ReconcileSeasonsRequest.js';
import type { ReconcileSeasonsResponse } from '../alerts/ReconcileSeasonsResponse.js';
import { reconcileSeasons } from '../alerts/reconcileSeasons.js';
import type { RecordAlertsRequest } from '../alerts/RecordAlertsRequest.js';
import type { RecordAlertsResponse } from '../alerts/RecordAlertsResponse.js';
import type { ReleaseState } from '../alerts/ReleaseState.js';
import { ApiError } from '../api/ApiError.js';
import { assertPlanOwned } from './assertPlanOwned.js';
import type { ConnectorServiceDeps } from './ConnectorServiceDeps.js';
import { loadPlanTitles } from './loadPlanTitles.js';
import { loadSyncState } from './loadSyncState.js';

/**
 * What the home connector does to the accounts with a Jellyfin user set: reading what the sync compares against,
 * applying a plan it computed at home, and refreshing the titles that plan created. Every method acts as the user
 * it is given, never as whoever signed in; the routes decide who may name whom.
 */
export class ConnectorService {
  constructor(private readonly deps: ConnectorServiceDeps) {}

  /** The users with a Jellyfin account set, ordered by id. */
  async users(): Promise<ConnectorUser[]> {
    const names = new Map((await this.deps.users.list()).map((user) => [user.id, user.name]));
    return (await this.deps.settings.list()).flatMap(({ userId, settings }) =>
      settings.jellyfinUser
        ? [{ id: userId, name: names.get(userId) ?? '', jellyfinUser: settings.jellyfinUser }]
        : [],
    );
  }

  async user(userId: number): Promise<ConnectorUser | undefined> {
    return (await this.users()).find((user) => user.id === userId);
  }

  state(userId: number): Promise<ConnectorSyncState> {
    return this.deps.scope.run(userId, async () => ({
      contentVersion: await this.deps.versions.current(userId),
      state: await loadSyncState(this.deps.targets),
      unfetched: await this.unfetched(),
    }));
  }

  apply(userId: number, request: ConnectorSyncRequest): Promise<ConnectorSyncResponse> {
    return this.deps.scope.run(userId, async () => {
      if ((await this.deps.versions.current(userId)) !== request.contentVersion) {
        throw ApiError.conflict(
          'content_changed',
          'The library changed since the plan was computed, read it again',
        );
      }
      assertPlanOwned(request.plan, await loadPlanTitles(request.plan, this.deps.targets));
      try {
        return await this.deps.applier.apply(request.plan);
      } finally {
        await this.deps.versions.bump(userId);
      }
    });
  }

  /** The users with an ntfy topic set, ordered by id. */
  async alertUsers(): Promise<AlertUser[]> {
    const names = new Map((await this.deps.users.list()).map((user) => [user.id, user.name]));
    return (await this.deps.settings.list()).flatMap(({ userId, settings }) =>
      settings.ntfyTopic ? [{ id: userId, name: names.get(userId) ?? '' }] : [],
    );
  }

  /** The user's followed titles with a TMDB id, their recorded alert keys and their ntfy topic, one read each. */
  releaseState(userId: number): Promise<ReleaseState> {
    return this.deps.scope.run(userId, async () => {
      const ntfyTopic = (await this.deps.settings.get(userId))?.ntfyTopic;
      if (!ntfyTopic) throw ApiError.notFound('That user has no ntfy topic set');
      const { movies, series } = this.deps.targets;
      return {
        ntfyTopic,
        series: followed(await series.listFollowed()),
        movies: followed(await movies.listFollowed()),
        alerts: await this.deps.alerts.allKeys(),
      };
    });
  }

  /** Links and creates the seasons a series' release data announces, as `reconcileSeasons` does at home. */
  reconcile(userId: number, request: ReconcileSeasonsRequest): Promise<ReconcileSeasonsResponse> {
    return this.deps.scope.run(userId, async () => {
      if (!(await this.deps.targets.series.get(request.seriesId))) throw ApiError.notFound();
      try {
        const seasons = await reconcileSeasons(
          request.seriesId,
          request.release,
          request.today,
          this.deps.targets,
        );
        return { seasons };
      } finally {
        await this.deps.versions.bump(userId);
      }
    });
  }

  /** Records alerts the connector delivered. Keys that were recorded before are ignored. */
  recordAlerts(userId: number, request: RecordAlertsRequest): Promise<RecordAlertsResponse> {
    return this.deps.scope.run(userId, async () => {
      let recorded = 0;
      for (const alert of request.alerts) {
        if (await this.deps.alerts.record(alert)) recorded += 1;
      }
      return { recorded };
    });
  }

  private async unfetched(): Promise<EntityRef[]> {
    const refs: EntityRef[] = [];
    for (const type of ['movie', 'series'] as const) {
      if (!this.deps.metadata?.supports(type)) continue;
      for (const id of await this.deps.states.unfetched(type)) refs.push({ type, id });
    }
    return refs;
  }

  refresh(userId: number, type: MediaType, id: number): Promise<RefreshResult> {
    const { metadata, editor, versions, scope } = this.deps;
    if (!metadata?.supports(type)) {
      throw ApiError.notImplemented(
        'no_metadata_source',
        `No metadata source is configured for ${type}`,
      );
    }
    return scope.run(userId, async () => {
      const collection = COLLECTIONS.find((c) => MEDIA_TYPE_OF_COLLECTION[c] === type);
      if (editor && collection) await editor.require(collection, id);
      try {
        return await metadata.refresh(type, id, true);
      } catch {
        throw ApiError.notFound();
      } finally {
        await versions.bump(userId);
      }
    });
  }
}

function followed(
  titles: readonly { id: number; tmdbId: number | null; title: string }[],
): FollowedTitle[] {
  return titles.flatMap((t) =>
    t.tmdbId === null ? [] : [{ id: t.id, tmdbId: t.tmdbId, title: t.title }],
  );
}
