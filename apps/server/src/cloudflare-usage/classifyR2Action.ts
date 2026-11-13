export type R2ActionClass = 'A' | 'B' | 'free' | 'unknown';

const CLASS_A = new Set([
  'ListBuckets',
  'PutBucket',
  'ListObjects',
  'ListObjectsV2',
  'PutObject',
  'CopyObject',
  'CreateMultipartUpload',
  'UploadPart',
  'UploadPartCopy',
  'CompleteMultipartUpload',
  'ListMultipartUploads',
  'ListParts',
  'PutBucketEncryption',
  'PutBucketCors',
  'PutBucketLifecycleConfiguration',
  'LifecycleStorageTierTransition',
]);

const CLASS_B = new Set([
  'HeadBucket',
  'HeadObject',
  'GetObject',
  'UsageSummary',
  'GetBucketEncryption',
  'GetBucketLocation',
  'GetBucketCors',
  'GetBucketLifecycleConfiguration',
]);

const FREE = new Set([
  'DeleteObject',
  'DeleteObjects',
  'DeleteBucket',
  'DeleteBucketCors',
  'DeleteBucketEncryption',
  'DeleteBucketLifecycle',
  'AbortMultipartUpload',
]);

/** Maps an R2 operation name to its billing class according to Cloudflare's R2 pricing. */
export function classifyR2Action(actionType: string): R2ActionClass {
  if (CLASS_A.has(actionType)) return 'A';
  if (CLASS_B.has(actionType)) return 'B';
  if (FREE.has(actionType)) return 'free';
  return 'unknown';
}
