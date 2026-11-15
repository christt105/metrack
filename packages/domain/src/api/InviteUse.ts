/** One person who joined through an invitation; `userId` and `userName` are null once that account is gone. */
export interface InviteUse {
  userId: number | null;
  userName: string | null;
  usedAt: string;
}
