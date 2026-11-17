import { createMemoryHistory } from 'vue-router';
import { describe, expect, it } from 'vitest';
import { createAppRouter } from '../src/router/createAppRouter';

describe('createAppRouter scrollBehavior', () => {
  const router = createAppRouter(createMemoryHistory());
  const behavior = router.options.scrollBehavior!;
  const route = router.currentRoute.value;

  it('restores the saved position on back and forward', async () => {
    expect(await behavior(route, route, { left: 0, top: 640 })).toEqual({ left: 0, top: 640 });
  });

  it('goes to the top on a new navigation', async () => {
    expect(await behavior(route, route, null)).toEqual({ top: 0 });
  });
});
