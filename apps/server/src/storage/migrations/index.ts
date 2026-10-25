import type { Migration } from '../Migration.js';
import { initialMigration } from './0001-initial.js';
import { dataModelMigration } from './0002-data-model.js';
import { imagesMigration } from './0003-images.js';
import { exportFieldsMigration } from './0004-export-fields.js';
import { movieFollowMigration } from './0005-movie-follow.js';
import { releaseAlertMigration } from './0006-release-alert.js';
import { imageSourceMigration } from './0007-image-source.js';

export const migrations: readonly Migration[] = [
  initialMigration,
  dataModelMigration,
  imagesMigration,
  exportFieldsMigration,
  movieFollowMigration,
  releaseAlertMigration,
  imageSourceMigration,
];
