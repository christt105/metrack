/** The fields of an edition, as nested in a search document, that metrack asks for. */
export interface OpenLibraryEdition {
  key?: string;
  title?: string;
  subtitle?: string;
  cover_i?: number;
  language?: string[];
  publisher?: string[];
  isbn?: string[];
}
