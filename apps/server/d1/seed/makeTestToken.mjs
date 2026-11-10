import process from 'node:process';
import { createHash, randomBytes } from 'node:crypto';

const secret = `mt_${randomBytes(32).toString('base64url')}`;
const hash = createHash('sha256').update(secret).digest('hex');
const now = new Date().toISOString();
process.stdout.write(
  `INSERT INTO api_token (user_id, name, secret_hash, scope, created_at, expires_at) VALUES (1, 'test login', '${hash}', 'write', '${now}', NULL);\n`,
);
process.stderr.write(`Token (shown once, keep it out of git): ${secret}\n`);
