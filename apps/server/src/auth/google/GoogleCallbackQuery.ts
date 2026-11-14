/** What Google appends to the redirect URI. */
export interface GoogleCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
}
