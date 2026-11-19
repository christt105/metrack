import { APP_CONTENT_SECURITY_POLICY } from './appContentSecurityPolicy.js';
import { PUBLIC_CONTENT_SECURITY_POLICY } from './publicContentSecurityPolicy.js';

const PUBLIC_PATH = /^\/(u(\/|$)|privacy\/?$)/;

/** The policy for a request path: the public one for `/u/*` and `/privacy`, the app one for everything else. */
export function contentSecurityPolicyFor(path: string): string {
  return PUBLIC_PATH.test(path) ? PUBLIC_CONTENT_SECURITY_POLICY : APP_CONTENT_SECURITY_POLICY;
}
