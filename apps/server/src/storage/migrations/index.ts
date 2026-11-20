import type { Migration } from '../Migration.js';
import { initialMigration } from './0001-initial.js';
import { dataModelMigration } from './0002-data-model.js';
import { imagesMigration } from './0003-images.js';
import { exportFieldsMigration } from './0004-export-fields.js';
import { movieFollowMigration } from './0005-movie-follow.js';
import { releaseAlertMigration } from './0006-release-alert.js';
import { imageSourceMigration } from './0007-image-source.js';
import { pendingReviewMigration } from './0008-pending-review.js';
import { catalogEntriesMigration } from './0009-catalog-entries.js';
import { usersMigration } from './0010-users.js';
import { dataOwnersMigration } from './0011-data-owners.js';
import { userSettingsMigration } from './0012-user-settings.js';
import { apiTokensMigration } from './0013-api-tokens.js';
import { userRolesMigration } from './0014-user-roles.js';
import { imageOwnersMigration } from './0015-image-owners.js';
import { publicPagesMigration } from './0016-public-pages.js';
import { publicPageProfileMigration } from './0017-public-page-profile.js';
import { accountDeletionMigration } from './0018-account-deletion.js';
import { queryIndexesMigration } from './0019-query-indexes.js';
import { connectorTokenScopeMigration } from './0020-connector-token-scope.js';
import { googleLoginMigration } from './0021-google-login.js';
import { invitesMigration } from './0022-invites.js';
import { episodeGroupMigration } from './0023-episode-group.js';
import { nextEpisodeMigration } from './0024-next-episode.js';
import { rewatchViewingsMigration } from './0025-rewatch-viewings.js';
import { seasonEpisodesMigration } from './0026-season-episodes.js';
import { seasonEpisodesRefillMigration } from './0027-season-episodes-refill.js';
import { dropSeasonOverrideMigration } from './0028-drop-season-override.js';
import { unmatchedEpisodesMigration } from './0029-unmatched-episodes.js';
import { dropPublishSettingsMigration } from './0030-drop-publish-settings.js';
import { userLanguageMigration } from './0031-user-language.js';

export const migrations: readonly Migration[] = [
  initialMigration,
  dataModelMigration,
  imagesMigration,
  exportFieldsMigration,
  movieFollowMigration,
  releaseAlertMigration,
  imageSourceMigration,
  pendingReviewMigration,
  catalogEntriesMigration,
  usersMigration,
  dataOwnersMigration,
  userSettingsMigration,
  apiTokensMigration,
  userRolesMigration,
  imageOwnersMigration,
  publicPagesMigration,
  publicPageProfileMigration,
  accountDeletionMigration,
  queryIndexesMigration,
  connectorTokenScopeMigration,
  googleLoginMigration,
  invitesMigration,
  episodeGroupMigration,
  nextEpisodeMigration,
  rewatchViewingsMigration,
  seasonEpisodesMigration,
  seasonEpisodesRefillMigration,
  dropSeasonOverrideMigration,
  unmatchedEpisodesMigration,
  dropPublishSettingsMigration,
  userLanguageMigration,
];
