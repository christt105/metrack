import {
  COLLECTIONS,
  MEDIA_TYPE_OF_COLLECTION,
  type ConnectorSyncRequest,
  type ConnectorSyncResponse,
  type ConnectorSyncState,
  type ConnectorUser,
  type MediaType,
  type RefreshResult,
} from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import { assertPlanOwned } from './assertPlanOwned.js';
import type { ConnectorServiceDeps } from './ConnectorServiceDeps.js';
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
      assertPlanOwned(request.plan, await loadSyncState(this.deps.targets));
      try {
        return await this.deps.applier.apply(request.plan);
      } finally {
        await this.deps.versions.bump(userId);
      }
    });
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
