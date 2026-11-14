/** A small D1-style SQL export: deferred foreign keys, an internal migrations table, images and a sequence. */
export function d1Dump(images: string[] = []): string {
  const rows = images
    .map((file) => {
      const [hash, extension] = file.split('.');
      return `INSERT INTO "image" ("hash","extension") VALUES('${hash}','${extension}');`;
    })
    .join('\n');
  return `PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0001_schema.sql','2026-11-10 22:56:27');
CREATE TABLE parent (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES parent (id), note TEXT, data BLOB);
CREATE TABLE image (hash TEXT NOT NULL, extension TEXT NOT NULL);
INSERT INTO "child" ("id","parent_id","note","data") VALUES(1,1,replace('line one{{NL}}it''s two','{{NL}}',char(10)),X'00FF10');
INSERT INTO "parent" ("id","name") VALUES(1,'Ana');
${rows}
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',4);
CREATE INDEX child_parent ON child (parent_id);
`;
}
