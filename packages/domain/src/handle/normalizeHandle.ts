/** The form a handle is stored and looked up in: trimmed and lowercase. */
export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase();
}
