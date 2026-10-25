/** Body of `POST /api/{collection}`: the entity fields without `id`, with `R` required. */
export type CreateInput<T, R extends keyof T> = Partial<Omit<T, 'id' | 'cover' | 'banner'>> &
  Pick<T, R>;
