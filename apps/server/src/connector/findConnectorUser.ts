import type { ConnectorUser } from '@metrack/domain';

/** The user a `--user` argument names: by id, name or Jellyfin account, ignoring case. */
export function findConnectorUser(
  users: readonly ConnectorUser[],
  wanted: string,
): ConnectorUser | undefined {
  const lower = wanted.toLowerCase();
  return (
    users.find((user) => String(user.id) === wanted) ??
    users.find((user) => user.name.toLowerCase() === lower) ??
    users.find((user) => user.jellyfinUser.toLowerCase() === lower)
  );
}
