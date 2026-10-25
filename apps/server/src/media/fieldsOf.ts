import type { MediaEntity } from './MediaEntity.js';

export function fieldsOf(entity: MediaEntity): Record<string, unknown> {
  return entity as unknown as Record<string, unknown>;
}
