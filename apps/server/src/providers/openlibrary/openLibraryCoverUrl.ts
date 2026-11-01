/** Url of an Open Library cover by id, at size `S`, `M` or `L`; it answers 404 instead of a blank image. */
export function openLibraryCoverUrl(
  coverId: number | undefined,
  size: 'S' | 'M' | 'L',
): string | null {
  return coverId && coverId > 0
    ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg?default=false`
    : null;
}
