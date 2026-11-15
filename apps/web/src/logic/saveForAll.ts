import { ApiRequestError } from '../api/ApiRequestError';

/**
 * Runs a save and, when the server refuses it because other users hold the catalog field, asks the owner to
 * confirm and runs it again for everyone. Anyone else gets the refusal.
 */
export async function saveForAll<T>(
  save: (options: { forAll?: boolean }) => Promise<T>,
  owner: boolean,
  confirm: () => boolean,
): Promise<T> {
  try {
    return await save({});
  } catch (cause) {
    const shared = cause instanceof ApiRequestError && cause.code === 'catalog_shared';
    if (!shared || !owner || !confirm()) throw cause;
    return save({ forAll: true });
  }
}
