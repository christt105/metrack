/** Remembers what was last published so an unchanged site is not deployed again. */
export interface PublishState {
  lastFingerprint(): string | null;
  record(fingerprint: string): void;
}
