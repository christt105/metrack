/**
 * Body of `PATCH /api/{collection}/{id}`: any subset of the entity fields except `id` and the
 * owning series. `cover` and `banner` are changed through the image routes instead. Setting
 * `status` applies the domain transition rules and also moves `startedAt` and `finishedAt`;
 * dates sent in the same request win over those automatic dates. With `restore: true` the request
 * may only carry tracking fields (`status`, `startedAt`, `finishedAt`, `rating`, `review`,
 * `rewatches`, `pendingReview`), which are set exactly as given: the status transition rules and
 * the automatic dates are skipped, while date validation and ordering still apply. Clients use it
 * to put a previous tracking snapshot back.
 */
export type EditablePatch<T> = Partial<Omit<T, 'id' | 'seriesId' | 'cover' | 'banner'>> & {
  restore?: boolean;
};
