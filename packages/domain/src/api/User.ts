/** Someone who can sign in. Everything personal (tracking, reviews, settings) belongs to one user. */
export interface User {
  id: number;
  name: string;
  email: string | null;
}
