export interface SignedRequestOptions {
  method: string;
  url: URL;
  /** Extra headers to sign besides host, x-amz-content-sha256 and x-amz-date. */
  headers?: Record<string, string>;
  /** SHA-256 of the body, hex; the hash of the empty string by default. */
  payloadHash?: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  date: Date;
}
