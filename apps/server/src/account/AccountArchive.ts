/** A finished export: the ZIP bytes and the name to download them as. */
export interface AccountArchive {
  fileName: string;
  bytes: Buffer;
}
