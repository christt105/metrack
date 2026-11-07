/** Body of `GET /api/images/usage`: how much of their quota the signed-in user's own images take; `quotaBytes` is `null` for the owner, who has none. */
export interface ImageUsage {
  usedBytes: number;
  quotaBytes: number | null;
}
