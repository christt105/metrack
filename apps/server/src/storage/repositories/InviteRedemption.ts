/** A new user that joins through an invitation: the SHA-256 of its code, the account to create and the moment. */
export interface InviteRedemption {
  codeHash: string;
  name: string;
  email: string;
  googleSub: string;
  at: string;
}
