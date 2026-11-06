/** Where to go after signing in: the `next` query when it is a path inside the app, the library otherwise. */
export function safeNext(next: unknown): string {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return '/';
  if (next.startsWith('/\\') || next.startsWith('/login')) return '/';
  return next;
}
