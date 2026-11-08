/** The year selector of the statistics page, from the theme. */
export const STATS_JS = String.raw`(function() {
    var sel = document.getElementById('stats-year-select');
    if (!sel) return;
    function apply() {
        var year = sel.value;
        document.querySelectorAll('[data-stats-year]').forEach(function(el) {
            el.hidden = el.getAttribute('data-stats-year') !== year;
        });
    }
    sel.addEventListener('change', apply);
    apply();
})();
`;
