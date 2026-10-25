/** Returns a function that turns an ISO timestamp into the `YYYY-MM-DD` date it falls on in `timeZone`. */
export function makeDateOf(timeZone: string): (iso: string) => string {
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return (iso) => format.format(new Date(iso));
}
