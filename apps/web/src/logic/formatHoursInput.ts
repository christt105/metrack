/** Minutes as the text of an hours input: whole hours as "12", otherwise "h:mm". */
export function formatHoursInput(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? String(hours) : `${hours}:${String(rest).padStart(2, '0')}`;
}
