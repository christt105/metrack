const month = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const day = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'full',
  timeZone: 'UTC',
});
const field = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

export const spanishCalendar = {
  month: (value: string) => month.format(new Date(`${value}-01T00:00:00Z`)),
  day: (value: string) => day.format(new Date(`${value}T00:00:00Z`)),
  field: (value: string) => field.format(new Date(`${value}T00:00:00Z`)),
  weekdays: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
};
