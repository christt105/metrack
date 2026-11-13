const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** Formats a count with thousands separators or a byte size in binary units. */
export function formatUsageValue(value: number, unit: 'count' | 'bytes'): string {
  if (unit === 'count') return Math.round(value).toLocaleString('en-US');
  let size = value;
  let index = 0;
  while (size >= 1024 && index < UNITS.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${index === 0 ? size : size.toFixed(2)} ${UNITS[index]}`;
}
