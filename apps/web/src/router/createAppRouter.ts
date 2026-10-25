import { createRouter, createWebHistory } from 'vue-router';
import type { RouterHistory } from 'vue-router';
import { routes } from './routes';

/** Builds the app router; tests pass a memory history. */
export function createAppRouter(history: RouterHistory = createWebHistory()) {
  return createRouter({ history, routes });
}
