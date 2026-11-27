const groups = ['type', 'status', 'rating', 'tag', 'platform'] as const;
type FilterGroup = (typeof groups)[number];

export function filters(): void {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;
  const search = document.querySelector<HTMLInputElement>('#media-search');
  const empty = document.getElementById('filter-empty');
  const cards = document.querySelectorAll<HTMLElement>('.home .card');
  const state: { q: string } & Record<FilterGroup, string[]> = {
    q: '',
    type: [],
    status: [],
    rating: [],
    tag: [],
    platform: [],
  };

  function norm(text: string | undefined) {
    return (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function active() {
    return state.q !== '' || groups.some((group) => state[group].length > 0);
  }

  function inGroup(group: FilterGroup, value: string | undefined) {
    return state[group].length === 0 || state[group].includes(value ?? '');
  }

  function inMany(group: FilterGroup, joined: string | undefined) {
    if (state[group].length === 0) return true;
    const values = (joined || '').split('|');
    return state[group].some((value) => values.includes(value));
  }

  function typeMatches(type: string | undefined) {
    return inGroup('type', type) || (type === 'season' && state.type.includes('tv'));
  }

  function matches(card: HTMLElement) {
    const d = card.dataset;
    if (!typeMatches(d.type)) return false;
    if (!inGroup('status', d.status) || !inGroup('rating', d.rating)) return false;
    if (!inMany('tag', d.tags) || !inMany('platform', d.platforms)) return false;
    return state.q === '' || (norm(d.title) + ' ' + norm(d.genres)).includes(state.q);
  }

  function apply() {
    const filtering = active();
    let shown = 0;
    cards.forEach((card) => {
      const show = !filtering || matches(card);
      card.hidden = !show;
      if (show && filtering) shown++;
    });
    document.querySelectorAll<HTMLElement>('.home .group').forEach((group) => {
      group.hidden = filtering && !group.querySelector('.card:not([hidden])');
    });
    const completed = document.getElementById('completed');
    if (completed) completed.hidden = filtering && !completed.querySelector('.group:not([hidden])');
    const yearNav = document.getElementById('year-nav');
    if (yearNav) yearNav.hidden = filtering;
    const aside = document.querySelector<HTMLDetailsElement>('#set-aside');
    if (aside) {
      const visible = !!aside.querySelector('.card:not([hidden])');
      aside.hidden = filtering && !visible;
      aside.open = filtering && visible;
    }
    if (empty) empty.hidden = !(filtering && shown === 0);
  }

  function refresh(groupElement: Element, group: FilterGroup) {
    groupElement.querySelectorAll('.chip').forEach((chip) => {
      const value = chip.getAttribute('data-value');
      const pressed = value === '' ? state[group].length === 0 : state[group].includes(value ?? '');
      chip.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    });
  }

  function syncUrl() {
    const params = new URLSearchParams();
    if (search && search.value.trim() !== '') params.set('q', search.value.trim());
    groups.forEach((group) => {
      if (state[group].length > 0) params.set(group, state[group].join(','));
    });
    const query = params.toString();
    history.replaceState(null, '', query ? '?' + query : location.pathname);
  }

  function toggle(group: FilterGroup, value: string) {
    if (value === '') {
      state[group] = [];
      return;
    }
    const index = state[group].indexOf(value);
    if (index === -1) state[group].push(value);
    else state[group].splice(index, 1);
  }

  const params = new URLSearchParams(location.search);
  bar.querySelectorAll('.chips[data-filter-group]').forEach((groupElement) => {
    const group = groupElement.getAttribute('data-filter-group') as FilterGroup;
    const selected = params.get(group);
    if (selected !== null) {
      const valid = Array.from(groupElement.querySelectorAll('.chip'), (chip) =>
        chip.getAttribute('data-value'),
      );
      state[group] = selected.split(',').filter((value) => value !== '' && valid.includes(value));
      refresh(groupElement, group);
    }
    groupElement.addEventListener('click', (event) => {
      const chip = (event.target as Element).closest('.chip');
      if (!chip) return;
      toggle(group, chip.getAttribute('data-value')!);
      refresh(groupElement, group);
      apply();
      syncUrl();
    });
  });
  if (state.tag.length > 0 || state.platform.length > 0) {
    const more = bar.querySelector<HTMLDetailsElement>('.filter-more');
    if (more) more.open = true;
  }
  if (search) {
    const query = params.get('q');
    if (query !== null) {
      search.value = query;
      state.q = norm(search.value.trim());
    }
    search.addEventListener('input', () => {
      state.q = norm(search.value.trim());
      apply();
      syncUrl();
    });
  }
  apply();
}
