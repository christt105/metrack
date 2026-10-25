export interface StoredImage {
  hash: string;
  ref: string;
  extension: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  sourceUrl: string | null;
  createdAt: string;
}
