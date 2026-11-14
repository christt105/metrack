export interface CloudBackupResult {
  /** Name of the new database copy, for example `metrack-20261114T043012345Z`. */
  name: string;
  /** Size of the SQL export, in bytes. */
  sqlBytes: number;
  /** Size of the database file, in bytes. */
  databaseBytes: number;
  /** Rows across all tables of the copy. */
  rows: number;
  /** Objects in the bucket, 0 when R2 is not copied. */
  bucketObjects: number;
  /** Images downloaded in this run. */
  images: number;
  /** Bytes of the images downloaded in this run. */
  imageBytes: number;
  /** Images the new database lists that are not in the copy. */
  missingImages: number;
  /** Copied databases removed by retention. */
  pruned: string[];
  /** Images removed because no retained database lists them. */
  prunedImages: number;
  durationMs: number;
}
