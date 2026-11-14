import { D1Exporter } from '../../src/cloudbackup/D1Exporter.js';

/** An exporter whose SQL comes from a function, so a test changes what each run exports or makes it fail. */
export class FakeD1 extends D1Exporter {
  constructor(private readonly sql: () => string | Error) {
    super('acct', 'db', 'token');
  }

  override async export(): Promise<string> {
    const sql = this.sql();
    if (sql instanceof Error) throw sql;
    return sql;
  }
}
