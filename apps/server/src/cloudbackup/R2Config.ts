export interface R2Config {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** S3 endpoint, without the bucket: `https://<account>.r2.cloudflarestorage.com` unless overridden. */
  endpoint: string;
}
