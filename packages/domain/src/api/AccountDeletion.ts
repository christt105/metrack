/** A scheduled account deletion: when it was asked for and when the account and its data will be erased. */
export interface AccountDeletion {
  requestedAt: string;
  deleteAt: string;
}
