/**
 * A front matter property the mirror owns. `always` properties are written even when empty, as the
 * plugin did; the rest only when they have a value or the note already had them.
 */
export interface Field {
  key: string;
  value: unknown;
  always: boolean;
  kind?: 'image' | 'links';
}
