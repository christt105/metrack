import type { SessionService } from '../auth/SessionService.js';
import type { UserRepository } from '../storage/repositories/UserRepository.js';

export interface AuthRouteDeps {
  sessions: SessionService;
  users: UserRepository;
  /** Offers every user on the sign-in page with no password. Only for a trusted network or development. */
  devLogin: boolean;
}
