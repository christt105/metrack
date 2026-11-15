import { HANDLE_MAX_LENGTH, normalizeHandle } from '@metrack/domain';

/** A public page handle derived from a display name: lowercase, with runs of other characters turned into one "-". */
export function suggestHandle(name: string): string {
  const folded = normalizeHandle(name).normalize('NFD').replace(/[̀-ͯ]/g, '');
  return folded
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, HANDLE_MAX_LENGTH)
    .replace(/-+$/g, '');
}
