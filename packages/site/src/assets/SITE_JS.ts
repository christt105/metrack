/** The one script of the public pages: the profile backdrop, the library filters, the statistics year and the collage. */
export const SITE_JS = String.raw`(function () {
  'use strict';

  var dataElement = document.getElementById('site-data');
  var data = dataElement ? JSON.parse(dataElement.textContent) : {};

  function backdrop() {
    var target = document.getElementById('profile-backdrop');
    var banners = data.banners || [];
    if (!target || banners.length === 0) return;
    var image = new Image();
    image.alt = '';
    image.decoding = 'async';
    image.addEventListener('load', function () {
      target.classList.add('is-loaded');
    });
    image.src = banners[Math.floor(Math.random() * banners.length)];
    target.appendChild(image);
  }

  function filters() {
    var bar = document.getElementById('filter-bar');
    if (!bar) return;
    var search = document.getElementById('media-search');
    var empty = document.getElementById('filter-empty');
    var cards = Array.prototype.slice.call(document.querySelectorAll('.home .card'));
    var groups = ['type', 'status', 'rating', 'tag', 'platform'];
    var state = { q: '', type: [], status: [], rating: [], tag: [], platform: [] };

    function norm(text) {
      return (text || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    function active() {
      if (state.q !== '') return true;
      return groups.some(function (group) {
        return state[group].length > 0;
      });
    }

    function inGroup(group, value) {
      return state[group].length === 0 || state[group].indexOf(value) !== -1;
    }

    function inMany(group, joined) {
      if (state[group].length === 0) return true;
      var values = (joined || '').split('|');
      return state[group].some(function (value) {
        return values.indexOf(value) !== -1;
      });
    }

    function typeMatches(type) {
      if (state.type.length === 0 || state.type.indexOf(type) !== -1) return true;
      return type === 'season' && state.type.indexOf('tv') !== -1;
    }

    function matches(card) {
      var d = card.dataset;
      if (!typeMatches(d.type)) return false;
      if (!inGroup('status', d.status) || !inGroup('rating', d.rating)) return false;
      if (!inMany('tag', d.tags) || !inMany('platform', d.platforms)) return false;
      return state.q === '' || (norm(d.title) + ' ' + norm(d.genres)).indexOf(state.q) !== -1;
    }

    function apply() {
      var filtering = active();
      var shown = 0;
      cards.forEach(function (card) {
        var show = !filtering || matches(card);
        card.hidden = !show;
        if (show && filtering) shown++;
      });
      document.querySelectorAll('.home .group').forEach(function (group) {
        group.hidden = filtering && !group.querySelector('.card:not([hidden])');
      });
      var completed = document.getElementById('completed');
      if (completed) completed.hidden = filtering && !completed.querySelector('.group:not([hidden])');
      var yearNav = document.getElementById('year-nav');
      if (yearNav) yearNav.hidden = filtering;
      var aside = document.getElementById('set-aside');
      if (aside) {
        var visible = !!aside.querySelector('.card:not([hidden])');
        aside.hidden = filtering && !visible;
        aside.open = filtering && visible;
      }
      if (empty) empty.hidden = !(filtering && shown === 0);
    }

    function refresh(groupElement, group) {
      groupElement.querySelectorAll('.chip').forEach(function (chip) {
        var value = chip.getAttribute('data-value');
        var pressed = value === '' ? state[group].length === 0 : state[group].indexOf(value) !== -1;
        chip.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      });
    }

    function syncUrl() {
      var params = new URLSearchParams();
      if (search && search.value.trim() !== '') params.set('q', search.value.trim());
      groups.forEach(function (group) {
        if (state[group].length > 0) params.set(group, state[group].join(','));
      });
      var query = params.toString();
      history.replaceState(null, '', query ? '?' + query : location.pathname);
    }

    function toggle(group, value) {
      if (value === '') {
        state[group] = [];
        return;
      }
      var index = state[group].indexOf(value);
      if (index === -1) state[group].push(value);
      else state[group].splice(index, 1);
    }

    var params = new URLSearchParams(location.search);
    bar.querySelectorAll('.chips[data-filter-group]').forEach(function (groupElement) {
      var group = groupElement.getAttribute('data-filter-group');
      if (params.has(group)) {
        var valid = Array.prototype.map.call(groupElement.querySelectorAll('.chip'), function (chip) {
          return chip.getAttribute('data-value');
        });
        state[group] = params.get(group).split(',').filter(function (value) {
          return value !== '' && valid.indexOf(value) !== -1;
        });
        refresh(groupElement, group);
      }
      groupElement.addEventListener('click', function (event) {
        var chip = event.target.closest('.chip');
        if (!chip) return;
        toggle(group, chip.getAttribute('data-value'));
        refresh(groupElement, group);
        apply();
        syncUrl();
      });
    });
    if (state.tag.length > 0 || state.platform.length > 0) {
      var more = bar.querySelector('.filter-more');
      if (more) more.open = true;
    }
    if (search) {
      if (params.has('q')) {
        search.value = params.get('q');
        state.q = norm(search.value.trim());
      }
      search.addEventListener('input', function () {
        state.q = norm(search.value.trim());
        apply();
        syncUrl();
      });
    }
    apply();
  }

  function statsYears() {
    var select = document.getElementById('stats-year-select');
    if (!select) return;
    function apply() {
      document.querySelectorAll('[data-stats-year]').forEach(function (block) {
        block.hidden = block.getAttribute('data-stats-year') !== select.value;
      });
    }
    select.addEventListener('change', apply);
    apply();
  }

  function collage() {
    var grid = document.getElementById('collage-grid');
    if (!grid) return;
    var from = document.getElementById('collage-from');
    var to = document.getElementById('collage-to');
    var columns = document.getElementById('collage-columns');
    var columnsValue = document.getElementById('collage-columns-value');
    var count = document.getElementById('collage-count');
    var download = document.getElementById('collage-download');
    var downloadLabel = document.getElementById('collage-download-label');
    var controls = document.getElementById('collage-controls');
    var TILE_WIDTH = 300;
    var TILE_HEIGHT = 450;
    var items = [];
    var shownColumns = 1;

    function day(date) {
      var month = String(date.getMonth() + 1).padStart(2, '0');
      return date.getFullYear() + '-' + month + '-' + String(date.getDate()).padStart(2, '0');
    }

    function corsSource(src) {
      var url = new URL(src, location.href);
      if (url.origin === location.origin) return url.href;
      url.searchParams.set('collage', '1');
      return url.href;
    }

    function render() {
      var types = Array.prototype.map.call(
        document.querySelectorAll('.collage-controls input[name="type"]:checked'),
        function (input) {
          return input.value;
        },
      );
      if (types.indexOf('tv') !== -1) types.push('season');
      var start = from.value || '0000-00-00';
      var end = to.value || '9999-99-99';
      var chosen = items.filter(function (item) {
        if (!item.date || types.indexOf(item.type) === -1) return false;
        var date = item.date.slice(0, 10);
        return date >= start && date <= end;
      });
      var wanted = Number(columns.value);
      shownColumns = chosen.length > 0 ? Math.min(wanted, chosen.length) : wanted;
      columnsValue.textContent = String(wanted);
      count.textContent = String(chosen.length);
      grid.style.setProperty('--columns', String(shownColumns));
      grid.replaceChildren.apply(
        grid,
        chosen.map(function (item) {
          var image = new Image(TILE_WIDTH, TILE_HEIGHT);
          image.crossOrigin = 'anonymous';
          image.alt = item.title;
          image.decoding = 'async';
          image.src = corsSource(item.image);
          return image;
        }),
      );
      download.disabled = chosen.length === 0;
    }

    function drawTile(context, image, x, y) {
      context.fillStyle = '#1f2725';
      context.fillRect(x, y, TILE_WIDTH, TILE_HEIGHT);
      if (!image.complete || image.naturalWidth === 0) return;
      var scale = Math.max(TILE_WIDTH / image.naturalWidth, TILE_HEIGHT / image.naturalHeight);
      var width = TILE_WIDTH / scale;
      var height = TILE_HEIGHT / scale;
      var left = (image.naturalWidth - width) / 2;
      var top = (image.naturalHeight - height) / 2;
      context.drawImage(image, left, top, width, height, x, y, TILE_WIDTH, TILE_HEIGHT);
    }

    function settle(image) {
      if (image.complete) return Promise.resolve();
      return new Promise(function (resolve) {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }

    function finish(text) {
      downloadLabel.textContent = text;
      setTimeout(function () {
        downloadLabel.textContent = data.download;
        download.disabled = false;
      }, text === data.download ? 0 : 2000);
    }

    download.addEventListener('click', function () {
      var images = Array.prototype.slice.call(grid.querySelectorAll('img'));
      if (images.length === 0) return;
      download.disabled = true;
      downloadLabel.textContent = data.generating;
      Promise.all(images.map(settle))
        .then(function () {
          var canvas = document.createElement('canvas');
          canvas.width = shownColumns * TILE_WIDTH;
          canvas.height = Math.ceil(images.length / shownColumns) * TILE_HEIGHT;
          var context = canvas.getContext('2d');
          if (!context) throw new Error('no canvas');
          images.forEach(function (image, index) {
            var x = (index % shownColumns) * TILE_WIDTH;
            var y = Math.floor(index / shownColumns) * TILE_HEIGHT;
            drawTile(context, image, x, y);
          });
          canvas.toBlob(function (blob) {
            if (!blob) {
              finish(data.tooLarge);
              return;
            }
            var url = URL.createObjectURL(blob);
            var link = document.createElement('a');
            link.download = 'collage_' + day(new Date()) + '.png';
            link.href = url;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(function () {
              URL.revokeObjectURL(url);
            }, 1000);
            finish(data.download);
          }, 'image/png');
        })
        .catch(function () {
          finish(data.failed);
        });
    });

    if (window.matchMedia('(max-width: 759px)').matches) {
      columns.value = '3';
      controls.open = false;
    }
    var today = new Date();
    from.value = today.getFullYear() + '-01-01';
    to.value = day(today);
    [from, to, columns].forEach(function (input) {
      input.addEventListener('input', render);
    });
    document.querySelectorAll('.collage-controls input[name="type"]').forEach(function (input) {
      input.addEventListener('change', render);
    });
    fetch(data.index)
      .then(function (response) {
        return response.json();
      })
      .then(function (index) {
        items = index;
        render();
      })
      .catch(function () {
        count.textContent = '0';
      });
  }

  backdrop();
  filters();
  statsYears();
  collage();
})();
`;
