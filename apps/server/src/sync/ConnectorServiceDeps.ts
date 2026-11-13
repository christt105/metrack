import type { MetadataCache } from '../metadata/MetadataCache.js';
import type { MediaEditor } from '../media/MediaEditor.js';
import type { ContentVersions } from '../site/ContentVersions.js';
import type { UserRepository } from '../storage/repositories/UserRepository.js';
import type { UserSettingsRepository } from '../storage/repositories/UserSettingsRepository.js';
import type { UserScope } from '../users/UserScope.js';
import type { SyncApplier } from './SyncApplier.js';
import type { SyncTargets } from './SyncTargets.js';

export interface ConnectorServiceDeps {
  users: UserRepository;
  settings: UserSettingsRepository;
  targets: SyncTargets;
  applier: SyncApplier;
  versions: ContentVersions;
  scope: UserScope;
  /** Fetches the metadata of created titles; refreshing answers 501 without it. */
  metadata?: MetadataCache;
  editor?: MediaEditor;
}
