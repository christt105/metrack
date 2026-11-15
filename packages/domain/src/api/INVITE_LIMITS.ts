/** What an invitation may be created with: how many people can use it and for how many days it stays valid. */
export const INVITE_LIMITS = {
  maxUses: 100,
  defaultExpiryDays: 7,
  maxExpiryDays: 90,
} as const;
