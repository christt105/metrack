/** Picks a random banner for the hero of the home from the items that have one, excluding seasons, as the theme does. */
export const BANNER_JS = String.raw`fetch(document.body.getAttribute('data-index'))
    .then(function (response) { return response.json(); })
    .then(function (data) {
        data = data.filter(function (item) { return item.banner && item.type !== 'season'; });
        if (data.length > 0) {
            var banner = data[Math.floor(Math.random() * data.length)].banner;
            var hero = document.getElementById('random-hero-banner');
            if (hero) hero.style.backgroundImage = 'url("' + banner + '")';
        }
    })
    .catch(function () {});
`;
