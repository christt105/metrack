/**
 * What a user may do beyond their own library. The `owner` (always user 1) runs the instance; a `trusted`
 * user may also add items by hand and use their own artwork; a `normal` user tracks titles from the providers.
 */
export type UserRole = 'owner' | 'trusted' | 'normal';
