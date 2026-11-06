/** Where image bytes live, addressed by file name (`<hash>.<extension>`). */
export interface ImageBlobStore {
  has(name: string): Promise<boolean>;
  read(name: string): Promise<Uint8Array>;
  /** Writes the whole file or nothing. */
  write(name: string, bytes: Uint8Array): Promise<void>;
  delete(name: string): Promise<void>;
}
