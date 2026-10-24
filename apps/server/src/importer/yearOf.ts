export function yearOf(date: string | null): number | null {
  return date === null ? null : Number(date.slice(0, 4));
}
