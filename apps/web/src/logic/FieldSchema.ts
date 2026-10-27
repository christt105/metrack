export type FieldKind =
  'text' | 'link' | 'textarea' | 'date' | 'integer' | 'rating' | 'list' | 'boolean';

export type FieldSection = 'ids' | 'metadata' | 'tracking' | 'notes';

/** Describes one editable field of an entity. */
export interface FieldSchema {
  key: string;
  kind: FieldKind;
  section: FieldSection;
  required?: boolean;
}
