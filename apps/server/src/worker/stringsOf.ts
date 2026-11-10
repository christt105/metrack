/** The variables and secrets of a Worker environment, without its bindings. */
export function stringsOf(env: Record<string, unknown>): Record<string, string> {
  const strings: Record<string, string> = {};
  for (const [name, value] of Object.entries(env)) {
    if (typeof value === 'string') strings[name] = value;
  }
  return strings;
}
