import { dumpStatements } from './dumpStatements.js';

/** The SQL file for `wrangler d1 execute <database> --remote --file`; see `dumpStatements`. */
export function dumpToSql(path: string): string {
  return `${dumpStatements(path).join('\n')}\n`;
}
