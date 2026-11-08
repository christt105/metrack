/** Search and filter chips of the library home, from the theme. */
export const FILTER_JS = String.raw`(function () {
    var bar = document.getElementById('filter-bar');
    if (!bar) return;

    var search = document.getElementById('media-search');
    var noResults = document.getElementById('filter-noresults');
    var cards = Array.prototype.slice.call(document.querySelectorAll('.media-card'));
    var yearNav = document.querySelector('.year-nav-container');
    var completedHeading = document.getElementById('completed-section');

    // Each group holds a set of selected values (empty = no constraint).
    var state = { q: '', type: [], status: [], rating: [], tag: [], platform: [] };
    var groups = ['type', 'status', 'rating', 'tag', 'platform'];

    function norm(s) {
        return (s || '').toString().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function anyActive() {
        if (state.q !== '') return true;
        for (var i = 0; i < groups.length; i++) { if (state[groups[i]].length) return true; }
        return false;
    }

    function inGroup(group, value) {
        return state[group].length === 0 || state[group].indexOf(value) !== -1;
    }

    // For multi-valued card attributes (pipe-delimited): match if any selected value is present
    function inMulti(group, pipe) {
        if (state[group].length === 0) return true;
        var vals = (pipe || '').split('|');
        for (var i = 0; i < state[group].length; i++) {
            if (vals.indexOf(state[group][i]) !== -1) return true;
        }
        return false;
    }

    function matchesType(cardType) {
        if (state.type.length === 0) return true;
        if (state.type.indexOf(cardType) !== -1) return true;
        // seasons belong to tv — selecting tv also shows seasons
        if (state.type.indexOf('tv') !== -1 && cardType === 'season') return true;
        return false;
    }

    function cardMatches(card) {
        if (!matchesType(card.getAttribute('data-type'))) return false;
        if (!inGroup('status', card.getAttribute('data-status'))) return false;
        if (!inGroup('rating', card.getAttribute('data-rating'))) return false;
        if (!inMulti('tag', card.getAttribute('data-tags'))) return false;
        if (!inMulti('platform', card.getAttribute('data-platforms'))) return false;
        if (state.q) {
            var hay = norm(card.getAttribute('data-title')) + ' ' + norm(card.getAttribute('data-genres'));
            if (hay.indexOf(state.q) === -1) return false;
        }
        return true;
    }

    function apply() {
        var filtering = anyActive();
        var visible = 0;

        cards.forEach(function (card) {
            var show = !filtering || cardMatches(card);
            card.classList.toggle('is-hidden', !show);
            if (show && filtering) visible++;
        });

        document.querySelectorAll('.home-section, .year-group').forEach(function (group) {
            if (!filtering) { group.classList.remove('is-hidden'); return; }
            var hasVisible = group.querySelector('.media-card:not(.is-hidden)');
            group.classList.toggle('is-hidden', !hasVisible);
        });

        var details = document.querySelector('.hidden-section-container');
        if (details) {
            if (filtering) {
                var hasVisible = details.querySelector('.media-card:not(.is-hidden)');
                details.classList.toggle('is-hidden', !hasVisible);
                if (hasVisible && details.tagName === 'DETAILS') details.open = true;
            } else {
                details.classList.remove('is-hidden');
                if (details.tagName === 'DETAILS') details.open = false;
            }
        }

        if (yearNav) yearNav.classList.toggle('is-hidden', filtering);
        if (completedHeading) {
            var anyYear = document.querySelector('.year-group:not(.is-hidden)');
            completedHeading.classList.toggle('is-hidden', filtering && !anyYear);
        }

        bar.classList.toggle('is-filtering', filtering);
        if (noResults) noResults.hidden = !(filtering && visible === 0);
    }

    function refreshChips(groupEl, group) {
        var allBtn = null;
        groupEl.querySelectorAll('.filter-chip').forEach(function (c) {
            var value = c.getAttribute('data-value');
            if (value === '') { allBtn = c; return; }
            c.classList.toggle('active', state[group].indexOf(value) !== -1);
        });
        if (allBtn) allBtn.classList.toggle('active', state[group].length === 0);
    }

    function syncUrl() {
        if (!window.history || !history.replaceState) return;
        var params = new URLSearchParams();
        if (state.q) params.set('q', state.q);
        groups.forEach(function (k) {
            if (state[k].length) params.set(k, state[k].join(','));
        });
        var qs = params.toString();
        history.replaceState(null, '', qs ? '?' + qs : location.pathname);
    }

    function toggleValue(group, value) {
        if (value === '') { state[group] = []; return; }
        var i = state[group].indexOf(value);
        if (i === -1) state[group].push(value); else state[group].splice(i, 1);
    }

    function initFromUrl() {
        var params = new URLSearchParams(location.search);
        groups.forEach(function (k) {
            if (!params.has(k)) return;
            var valid = {};
            bar.querySelectorAll('.filter-chips[data-filter-group="' + k + '"] .filter-chip').forEach(function (c) {
                valid[c.getAttribute('data-value')] = true;
            });
            state[k] = params.get(k).split(',').filter(function (v) { return v && valid[v]; });
            var groupEl = bar.querySelector('.filter-chips[data-filter-group="' + k + '"]');
            if (groupEl) refreshChips(groupEl, k);
        });
        // Open the advanced section if a tag/platform filter is active
        if ((state.tag.length || state.platform.length)) {
            var adv = bar.querySelector('.filter-advanced');
            if (adv) adv.open = true;
        }
        if (params.has('q') && search) {
            state.q = norm(params.get('q').trim());
            search.value = params.get('q');
        }
    }

    if (search) {
        search.addEventListener('input', function () {
            state.q = norm(search.value.trim());
            apply();
            syncUrl();
        });
    }

    bar.querySelectorAll('.filter-chips').forEach(function (groupEl) {
        var group = groupEl.getAttribute('data-filter-group');
        groupEl.addEventListener('click', function (e) {
            var chip = e.target.closest('.filter-chip');
            if (!chip) return;
            toggleValue(group, chip.getAttribute('data-value'));
            refreshChips(groupEl, group);
            apply();
            syncUrl();
        });
    });

    initFromUrl();
    apply();
})();
`;
