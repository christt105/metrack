/**
 * An entity plus its cache bookkeeping. `editedFields` are the fields a refresh will never overwrite
 * and `fetchedAt` is when the provider was last asked.
 */
export type MediaDetail<T> = T & { editedFields: string[]; fetchedAt: string | null };
