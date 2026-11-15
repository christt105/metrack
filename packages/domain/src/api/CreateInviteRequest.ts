/** Body of `POST /api/invites`. `expiresInDays` defaults to `INVITE_LIMITS.defaultExpiryDays`. */
export interface CreateInviteRequest {
  maxUses: number;
  expiresInDays?: number;
}
