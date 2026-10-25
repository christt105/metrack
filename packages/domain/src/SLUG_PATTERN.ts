/**
 * A slug is the folder name of an exported page: a single path segment that is not `.` or `..`,
 * has no surrounding whitespace, and has no path separators, control characters or characters that
 * are unsafe in file names or meaningful in URLs and Hugo references. Meant for a `u` regular
 * expression, so JSON Schema validators can use it as is.
 */
export const SLUG_PATTERN = String.raw`^(?!\.\.?$)(?=\S)(?=[\s\S]*\S$)[^\\/:*?"<>|#%[\]\p{Cc}]+$`;
