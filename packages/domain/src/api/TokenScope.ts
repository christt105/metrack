/**
 * What a personal API token may do: `read` only reads, `write` also changes the user's library, and `connector`
 * (the owner only) acts as the home connector on `/api/connector` and nowhere else.
 */
export type TokenScope = 'read' | 'write' | 'connector';
