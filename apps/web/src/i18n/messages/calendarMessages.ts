/** Calendar texts for one locale, always laid out Monday first whatever the browser's region says. */
export function calendarMessages(locale: string, weekdays: readonly string[]) {
  const month = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' });
  const field = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return {
    month: (value: string) => month.format(new Date(`${value}-01T00:00:00Z`)),
    day: (value: string) => day.format(new Date(`${value}T00:00:00Z`)),
    field: (value: string) => field.format(new Date(`${value}T00:00:00Z`)),
    weekdays,
  };
}
