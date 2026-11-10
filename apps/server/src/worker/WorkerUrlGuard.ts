import { ImageRejectedError } from '../images/ImageRejectedError.js';
import type { UrlGuard } from '../images/UrlGuard.js';

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const LOCAL_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.home.arpa'];

/**
 * Lets the Worker fetch only http and https URLs addressed by a public-looking name. A Worker cannot resolve
 * names itself, so IP literals and local-looking names are refused outright.
 */
export class WorkerUrlGuard implements UrlGuard {
  async check(url: URL): Promise<void> {
    const host = url.hostname.toLowerCase();
    const literal = IPV4.test(host) || host.includes(':') || host.startsWith('[');
    const local =
      host === 'localhost' ||
      !host.includes('.') ||
      LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix));
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || literal || local) {
      throw new ImageRejectedError(
        'url_not_allowed',
        'Images can only come from public web addresses',
      );
    }
  }
}
