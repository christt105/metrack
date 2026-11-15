/** Body of `POST /api/account/welcome`: the display name and the public page handle a new user confirms on first entry. */
export interface WelcomeRequest {
  name: string;
  handle: string;
}
