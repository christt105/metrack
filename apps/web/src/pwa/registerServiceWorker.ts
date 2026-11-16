/** Registers the service worker that keeps the app shell available offline. Does nothing where service workers do not exist. */
export function registerServiceWorker(
  target: Pick<Window, 'addEventListener'>,
  container: Pick<ServiceWorkerContainer, 'register'> | undefined,
): void {
  if (!container) return;
  target.addEventListener('load', () => {
    void container.register('/sw.js', { scope: '/' }).catch(() => undefined);
  });
}
