import { APP_CONTENT_SECURITY_POLICY } from './appContentSecurityPolicy.js';

const GISCUS = 'https://giscus.app';

function withGiscus(directive: string): string {
  const [name] = directive.split(' ');
  if (name === 'script-src' || name === 'style-src') return `${directive} ${GISCUS}`;
  if (name === 'frame-src') return `frame-src ${GISCUS}`;
  return directive;
}

/** The enforced policy of the public pages (`/u/*` and `/privacy`): the app's, plus the giscus comments script, stylesheet and frame. */
export const PUBLIC_CONTENT_SECURITY_POLICY = APP_CONTENT_SECURITY_POLICY.split('; ')
  .map(withGiscus)
  .join('; ');
