/** The fields of a work record (`/works/<id>.json`) that the search endpoint does not return. */
export interface OpenLibraryWorkRecord {
  description?: string | { value?: string };
  first_publish_date?: string;
}
