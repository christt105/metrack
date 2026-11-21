const KEY = 'metrack.customPlatforms';

/** The platforms the user wrote themselves on this device, in the order they were added. */
export function loadCustomPlatforms(storage: Pick<Storage, 'getItem'> = localStorage): string[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

/** Remembers a platform the user wrote themselves, so the picker offers it again. */
export function rememberCustomPlatform(
  name: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): void {
  const known = loadCustomPlatforms(storage);
  if (known.includes(name)) return;
  try {
    storage.setItem(KEY, JSON.stringify([...known, name]));
  } catch {
    return;
  }
}
