/** Body of `GET /api/images/usage`: how much of their quota the signed-in user's own images take. */
export interface ImageUsage {
  usedBytes: number;
  quotaBytes: number;
}
