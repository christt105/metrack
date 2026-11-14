import type { SessionService } from '../auth/SessionService.js';
import type { GoogleSignIn } from '../auth/google/GoogleSignIn.js';
import type { Logger } from '../notify/Logger.js';
import type { UserRepository } from '../storage/repositories/UserRepository.js';

export interface AuthRouteDeps {
  sessions: SessionService;
  users: UserRepository;
  /** Offers every user on the sign-in page with no password. Only for a trusted network or development. */
  devLogin: boolean;
  /** "Sign in with Google" for existing users; its routes exist only when this is given. */
  google?: GoogleSignIn;
  logger?: Logger;
}
