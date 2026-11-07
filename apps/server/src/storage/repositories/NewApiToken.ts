import type { StoredApiToken } from './StoredApiToken.js';

export type NewApiToken = Omit<StoredApiToken, 'id' | 'lastUsedAt'>;
