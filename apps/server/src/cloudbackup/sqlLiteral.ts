function placeholder(value: string, base: string): string {
  let token = base;
  for (let n = 1; value.includes(token); n += 1) token = `${base}${n}`;
  return token;
}

function text(value: string): string {
  if (!/[\r\n]/.test(value)) return `'${value.replace(/'/g, "''")}'`;
  const newline = placeholder(value, '{{NL}}');
  const carriage = placeholder(value, '{{CR}}');
  const escaped = value.replace(/'/g, "''").replace(/\r/g, carriage).replace(/\n/g, newline);
  const withNewlines = `replace('${escaped}','${newline}',char(10))`;
  return value.includes('\r') ? `replace(${withNewlines},'${carriage}',char(13))` : withNewlines;
}

/** A value read from SQLite as a SQL literal. Text with line breaks is written with placeholders that `replace()` turns back into `char(10)` and `char(13)`, as D1's own export does, so every statement stays on one line and the expression stays shallow. */
export function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'string') return text(value);
  if (value instanceof Uint8Array) return `X'${Buffer.from(value).toString('hex')}'`;
  throw new Error(`Cannot write a ${typeof value} as SQL`);
}
