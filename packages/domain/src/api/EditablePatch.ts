/**
 * Body of `PATCH /api/{collection}/{id}`: any subset of the entity fields except `id` and the
 * owning series. `cover` and `banner` are changed through the image routes instead. Setting
 * `status` applies the domain transition rules and also moves `startedAt` and `finishedAt`;
 * dates sent in the same request win over those automatic dates.
 */
export type EditablePatch<T> = Partial<Omit<T, 'id' | 'seriesId' | 'cover' | 'banner'>>;
