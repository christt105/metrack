import type { Router } from 'vue-router';
import type { Session } from '../auth/Session';

/**
 * Sends every route not marked `meta.public` to the sign-in page when nobody is signed in, and a user who has
 * not yet confirmed their name and handle to the first-entry form. If the server cannot be reached the page
 * opens anyway and shows its own error.
 */
export function installAuthGuard(router: Router, session: Session): void {
  router.beforeEach(async (to) => {
    if (to.meta.public) return true;
    let user;
    try {
      user = await session.current();
    } catch {
      return true;
    }
    if (!user) return { name: 'login', query: to.fullPath === '/' ? {} : { next: to.fullPath } };
    if (session.needsWelcome.value && to.name !== 'welcome') return { name: 'welcome' };
    if (!session.needsWelcome.value && to.name === 'welcome') return { name: 'library' };
    return true;
  });
}
