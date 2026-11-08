/** A number with one decimal and a comma, as the Spanish pages write it. */
export function formatDecimal(value: number): string {
  return value.toFixed(1).replace('.', ',');
}
