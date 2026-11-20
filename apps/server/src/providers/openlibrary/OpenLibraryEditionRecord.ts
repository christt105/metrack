/** The fields of an entry of `/works/<id>/editions.json` that carry covers. */
export interface OpenLibraryEditionRecord {
  covers?: number[];
  languages?: { key: string }[];
}
