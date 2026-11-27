import { Window } from 'happy-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { SITE_JS } from '../src/assets/SITE_JS.js';

function chips(group: string, ...values: string[]): string {
  return `<div class="chips" data-filter-group="${group}">${['', ...values]
    .map(
      (value) =>
        `<button type="button" class="chip" data-value="${value}" aria-pressed="${value === ''}"><span>${value || 'All'}</span></button>`,
    )
    .join('')}</div>`;
}

const library = `<main class="home">
  <div id="filter-bar" class="filter-bar">
    <label class="search"><input id="media-search" type="search"></label>
    <div class="filter-rows">
      ${chips('type', 'movie', 'tv', 'videogame', 'book')}
      ${chips('status', 'finished', 'in_progress', 'paused')}
      ${chips('rating', '7', '9')}
    </div>
    <details class="filter-more"><summary>More filters</summary>
      ${chips('platform', 'pc', 'switch')}
      ${chips('tag', 'classic', 'indie', 'travel')}
    </details>
    <p id="filter-empty" class="filter-empty" hidden>No results</p>
  </div>
  <section class="group" id="in-progress"><div class="grid">
    <article id="game" class="card" data-type="videogame" data-status="in_progress" data-rating="" data-title="celeste" data-genres="platformer" data-tags="indie|classic" data-platforms="pc|switch"></article>
  </div></section>
  <section id="completed" class="completed">
    <nav id="year-nav" class="year-nav"></nav>
    <section class="group year-group" id="recent"><div class="grid">
      <article id="movie" class="card" data-type="movie" data-status="finished" data-rating="9" data-title="amélie" data-genres="romance|comédie" data-tags="travel|classic" data-platforms=""></article>
    </div></section>
    <section class="group year-group" id="older"><div class="grid">
      <article id="season" class="card" data-type="season" data-status="finished" data-rating="7" data-title="lupin" data-genres="drama" data-tags="travel" data-platforms=""></article>
    </div></section>
  </section>
  <details id="set-aside" class="set-aside"><summary>Paused or dropped</summary>
    <section class="group"><div class="grid">
      <article id="book" class="card" data-type="book" data-status="paused" data-rating="" data-title="neuromancer" data-genres="science fiction" data-tags="classic" data-platforms=""></article>
    </div></section>
  </details>
</main>`;

let browser: Window;
afterEach(async () => browser.happyDOM.close());

function start(query = ''): void {
  browser = new Window({
    url: 'https://example.test/u/ana/' + query,
    settings: { enableJavaScriptEvaluation: true },
  });
  browser.document.body.innerHTML = library;
  browser.eval(SITE_JS);
}

function chip(group: string, value: string) {
  return browser.document.querySelector(`[data-filter-group="${group}"] [data-value="${value}"]`)!;
}

function click(group: string, value: string): void {
  chip(group, value)
    .querySelector('span')!
    .dispatchEvent(new browser.MouseEvent('click', { bubbles: true }));
}

function visibleCards(): string[] {
  return [...browser.document.querySelectorAll('.card:not([hidden])')].map((card) => card.id);
}

const hidden = (id: string) => browser.document.getElementById(id)!.hasAttribute('hidden');
const asideOpen = () => browser.document.getElementById('set-aside')!.hasAttribute('open');

function search(text: string): void {
  const input = browser.document.querySelector('input')!;
  input.value = text;
  input.dispatchEvent(new browser.Event('input'));
}

describe('public library filters', () => {
  it.each(['  AMELIE  ', 'COMEDIE'])('matches the title or genre for %j', (text) => {
    start();
    search(text);
    expect(visibleCards()).toEqual(['movie']);
    expect(new URLSearchParams(browser.location.search).get('q')).toBe(text.trim());
    expect(hidden('older')).toBe(true);
    expect(hidden('recent')).toBe(false);
  });

  it.each([
    { group: 'type', value: 'tv', cards: ['season'] },
    { group: 'status', value: 'paused', cards: ['book'] },
    { group: 'rating', value: '9', cards: ['movie'] },
    { group: 'tag', value: 'classic', cards: ['game', 'movie', 'book'] },
    { group: 'platform', value: 'switch', cards: ['game'] },
  ])('filters by $group', ({ group, value, cards }) => {
    start();
    click(group, value);
    expect(visibleCards()).toEqual(cards);
    expect(chip(group, value).getAttribute('aria-pressed')).toBe('true');
    expect(chip(group, '').getAttribute('aria-pressed')).toBe('false');
    expect(browser.location.search).toBe(`?${group}=${value}`);
  });

  it('matches any selected value in a group and requires every active group to match', () => {
    start();
    click('type', 'tv');
    click('type', 'movie');
    expect(visibleCards()).toEqual(['movie', 'season']);
    click('tag', 'classic');
    expect(visibleCards()).toEqual(['movie']);
    click('tag', 'travel');
    expect(visibleCards()).toEqual(['movie', 'season']);
    click('rating', '7');
    expect(visibleCards()).toEqual(['season']);
    click('type', 'tv');
    expect(visibleCards()).toEqual([]);
  });

  it('shows the empty state and restores the sections and year navigation when cleared', () => {
    start();
    click('status', 'paused');
    expect(asideOpen()).toBe(true);
    expect(hidden('completed')).toBe(true);
    expect(hidden('year-nav')).toBe(true);
    search('no match');
    expect(visibleCards()).toEqual([]);
    expect(hidden('filter-empty')).toBe(false);
    expect(hidden('set-aside')).toBe(true);
    expect(hidden('in-progress')).toBe(true);
    expect(asideOpen()).toBe(false);

    click('status', '');
    search('');
    expect(visibleCards()).toEqual(['game', 'movie', 'season', 'book']);
    expect(hidden('filter-empty')).toBe(true);
    expect(hidden('completed')).toBe(false);
    expect(hidden('year-nav')).toBe(false);
    expect(hidden('set-aside')).toBe(false);
    expect(asideOpen()).toBe(false);
    expect(browser.location.href).toBe('https://example.test/u/ana/');
  });

  it('restores valid selections and opens advanced filters for a shared URL', () => {
    start('?q=Celeste&platform=invalid,switch&tag=indie');
    expect(visibleCards()).toEqual(['game']);
    expect(browser.document.querySelector('input')!.value).toBe('Celeste');
    expect(browser.document.querySelector('details.filter-more')!.hasAttribute('open')).toBe(true);
    expect(chip('platform', 'switch').getAttribute('aria-pressed')).toBe('true');
    click('type', 'videogame');
    expect(browser.location.search).toBe('?q=Celeste&type=videogame&tag=indie&platform=switch');
  });
});
