import { renderLayout } from './renderLayout.js';

/** The page every missing public address answers with, the same whatever is missing. */
export function renderNotFound(): string {
  return renderLayout({
    title: 'No encontrado',
    body: '<main><h1>No encontrado</h1><p>Esta página no existe.</p></main>',
  });
}
