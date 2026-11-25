import { describe, expect, it } from 'vitest';
import { buildLibrary, renderDetail, renderHome, renderStats } from '../src/index.js';
import { game, input } from './support.js';

const done = { achievementsUnlocked: 40, achievementsTotal: 40 };

const library = (games: Parameters<typeof game>[0][]) =>
  buildLibrary(input({ videogames: games.map((overrides) => game(overrides)) }));

describe('public achievements', () => {
  const full = library([
    { id: 1, title: 'Complete', status: 'completed', finishedAt: '2026-02-01', ...done },
    {
      id: 2,
      title: 'Partial',
      status: 'completed',
      finishedAt: '2026-02-02',
      achievementsUnlocked: 3,
      achievementsTotal: 40,
    },
    { id: 3, title: 'Unknown', status: 'completed', finishedAt: '2026-02-03' },
    {
      id: 4,
      title: 'Without',
      status: 'completed',
      finishedAt: '2026-02-04',
      achievementsUnlocked: 0,
      achievementsTotal: 0,
    },
  ]);

  it('marks only the complete game on the list', () => {
    const html = renderHome(full);
    expect(html.match(/card-trophy"/g)).toHaveLength(1);
    expect(html).toContain('title="Todos los logros"');
    const card = html.split('<article class="card"').find((part) => part.includes('Complete'));
    expect(card).toContain('card-trophy');
  });

  it('counts the games with every achievement in the profile stats', () => {
    const html = renderStats(full);
    expect(html).toContain(' 1</span><span class="stat-label">Juegos con todos los logros</span>');
  });

  it('shows the badge and the count on the game page', () => {
    const page = renderDetail(full, 'videogame', 1) as string;
    expect(page).toContain('pill-trophy');
    expect(page).toContain('Todos los logros</span>');
    const partial = renderDetail(full, 'videogame', 2) as string;
    expect(partial).toContain(' Logros 3 / 40</span>');
    expect(partial).not.toContain('pill-trophy');
    const unknown = renderDetail(full, 'videogame', 3) as string;
    expect(unknown).not.toContain('Logros');
    expect(renderDetail(full, 'videogame', 4)).not.toContain('Logros');
  });

  it('adds nothing without a complete game', () => {
    const html = renderHome(
      library([
        {
          id: 1,
          title: 'Partial',
          status: 'completed',
          finishedAt: '2026-02-02',
          achievementsUnlocked: 1,
          achievementsTotal: 2,
        },
      ]),
    );
    expect(html).not.toContain('card-trophy"');
    expect(
      renderStats(
        library([
          {
            id: 1,
            title: 'P',
            status: 'completed',
            finishedAt: '2026-02-02',
            achievementsUnlocked: 1,
            achievementsTotal: 2,
          },
        ]),
      ),
    ).not.toContain('Juegos con todos los logros');
  });
});
