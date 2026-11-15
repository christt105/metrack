import { describe, expect, it } from 'vitest';
import type { AnyDetail } from '../src/api/AnyDetail';
import ArtworkPanel from '../src/components/ArtworkPanel.vue';
import { mountWithApi } from './mountWithApi';

const season = (cover: string | null) =>
  ({ id: 9, cover, banner: null, editedFields: [], fetchedAt: null }) as unknown as AnyDetail;

describe('ArtworkPanel', () => {
  it('shows the series cover for a season that has none, and says where it comes from', async () => {
    const { wrapper } = await mountWithApi(
      ArtworkPanel,
      {},
      {
        collection: 'seasons',
        detail: season(null),
        fallback: { cover: 'img:series', banner: null },
      },
    );
    const images = wrapper.findAll('img');
    expect(images).toHaveLength(1);
    expect(images[0]?.attributes('src')).toContain('series');
    expect(wrapper.text()).toContain('From the series');
  });

  it('prefers the cover of the season itself', async () => {
    const { wrapper } = await mountWithApi(
      ArtworkPanel,
      {},
      {
        collection: 'seasons',
        detail: season('img:own'),
        fallback: { cover: 'img:series', banner: null },
      },
    );
    expect(wrapper.find('img').attributes('src')).toContain('own');
    expect(wrapper.text()).not.toContain('From the series');
  });
});
