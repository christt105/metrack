import { describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from '../src/pwa/registerServiceWorker';

function fakeWindow() {
  const listeners = new Map<string, () => void>();
  return {
    target: {
      addEventListener: (type: string, listener: () => void) => void listeners.set(type, listener),
    },
    fire: (type: string) => listeners.get(type)?.(),
  };
}

describe('registerServiceWorker', () => {
  it('registers /sw.js at the root scope once the page has loaded', () => {
    const { target, fire } = fakeWindow();
    const register = vi.fn().mockResolvedValue({});
    registerServiceWorker(target as unknown as Window, { register });
    expect(register).not.toHaveBeenCalled();
    fire('load');
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('does nothing without service worker support', () => {
    const { target } = fakeWindow();
    const spy = vi.spyOn(target, 'addEventListener');
    registerServiceWorker(target as unknown as Window, undefined);
    expect(spy).not.toHaveBeenCalled();
  });

  it('swallows a failed registration', async () => {
    const { target, fire } = fakeWindow();
    const register = vi.fn().mockRejectedValue(new Error('denied'));
    registerServiceWorker(target as unknown as Window, { register });
    expect(() => fire('load')).not.toThrow();
    await Promise.resolve();
  });
});
