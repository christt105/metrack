/** The stylesheet of every public page, after the look of the Hugo theme: cover cards, banner headers and status badges. */
export const SITE_CSS = `:root {
  --bg: #ffffff;
  --text: #222222;
  --secondary: #6b7280;
  --primary: #2563eb;
  --card: rgba(128, 128, 128, 0.08);
  --line: rgba(128, 128, 128, 0.3);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121212;
    --text: #e5e7eb;
    --secondary: #9ca3af;
    --primary: #6ea0ff;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  line-height: 1.5;
}
a { color: var(--primary); }
img { max-width: 100%; }
.navbar { border-bottom: 1px solid var(--line); }
.navbar nav { display: flex; justify-content: space-between; align-items: center; max-width: 1100px; margin: 0 auto; padding: 12px 20px; }
.navbar .logo { font-weight: 800; font-size: 1.1rem; color: inherit; text-decoration: none; }
.navbar .feed-link { font-size: 0.85rem; }
.wrapper { max-width: 1100px; margin: 0 auto; padding: 20px; }
.footer { text-align: center; padding: 30px 20px; color: var(--secondary); }
.profile-header h1 { font-size: 2.2rem; margin: 10px 0 0; }
.type-nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 0; }
.type-nav a { border: 1px solid var(--line); border-radius: 6px; padding: 6px 12px; color: inherit; text-decoration: none; font-weight: 600; }
.type-nav a:hover { border-color: var(--primary); color: var(--primary); }
.section-title { margin-top: 40px; margin-bottom: 20px; font-size: 1.5rem; border-bottom: 2px solid var(--secondary); padding-bottom: 10px; }
.section-divider { margin: 40px 0; border: 0; border-top: 1px dashed #ccc; }
.subsection-title { margin: 24px 0 15px; font-size: 1.2rem; opacity: 0.7; }
.year-title { font-size: 2.5rem; font-weight: 800; margin: 30px 0 20px; opacity: 0.3; border-bottom: 1px solid rgba(128, 128, 128, 0.2); }
.hidden-section-container { margin: 30px 0; }
.hidden-section-container summary { cursor: pointer; opacity: 0.7; font-weight: bold; padding: 10px; }
.media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 20px; }
.media-card { position: relative; border-radius: 8px; overflow: hidden; transition: transform 0.2s; }
.media-card:hover { transform: scale(1.03); }
.media-poster { position: relative; overflow: hidden; border-radius: 6px; background: var(--card); }
.media-poster img { width: 100%; height: auto; aspect-ratio: 2 / 3; object-fit: cover; display: block; }
.no-cover { display: flex; align-items: center; justify-content: center; aspect-ratio: 2 / 3; font-size: 3rem; font-weight: 800; opacity: 0.3; }
.badge-type, .badge-content, .badge-rating { position: absolute; color: white; padding: 5px 8px; font-size: 0.75rem; z-index: 1; line-height: 1; pointer-events: none; }
.badge-type { top: 0; left: 0; border-radius: 6px 0 6px 0; background: #2c3e50; }
.badge-type.movie { background: #2980b9; }
.badge-type.series, .badge-type.season { background: #8e44ad; }
.badge-type.videogame { background: #c0392b; }
.badge-type.book { background: #16a085; }
.badge-content { top: 0; right: 0; border-radius: 0 6px 0 6px; background: rgba(255, 255, 255, 0.9); color: #222; font-weight: bold; }
.badge-rating { bottom: 0; right: 0; border-radius: 6px 0 6px 0; font-weight: bold; font-size: 0.85rem; }
.margin-rating { position: absolute; bottom: 0; left: 0; width: 100%; height: 4px; z-index: 2; pointer-events: none; }
.media-info h3 { margin: 8px 0 2px; font-size: 1rem; line-height: 1.3; }
.media-info h3 a { color: inherit; text-decoration: none; }
.media-info h3 a:hover { color: var(--primary); }
.media-info small { color: var(--secondary); }
.media-header { position: relative; margin-bottom: 40px; border-radius: 12px; }
.banner-container { position: relative; width: 100%; line-height: 0; z-index: 0; }
.media-banner-img { width: 100%; height: auto; max-height: 420px; object-fit: cover; display: block; border-radius: 12px; }
.banner-gradient-mask { position: absolute; inset: 0; pointer-events: none; border-radius: 12px; background: linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.25) 80%, rgba(0, 0, 0, 0.6) 100%); }
.media-info-container { display: flex; gap: 30px; margin-top: -100px; padding: 0 30px; position: relative; z-index: 2; }
.media-simple-header { display: flex; gap: 30px; margin-bottom: 30px; }
.media-cover { flex-shrink: 0; width: 220px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5); background: #222; align-self: flex-start; }
.media-simple-header .media-cover { width: 200px; }
.media-cover img { border-radius: 8px; width: 100%; height: auto; display: block; aspect-ratio: 2 / 3; object-fit: cover; }
.media-details { flex-grow: 1; min-width: 0; }
.media-info-container .media-details { padding-top: 110px; }
.header-title { margin: 0 0 10px; font-size: 2.8rem; line-height: 1.1; font-weight: 800; }
.media-meta { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 20px; color: var(--secondary); }
.status-badge { padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: white; background: #95a5a6; display: inline-flex; letter-spacing: 0.5px; }
.status-badge.type-movie { background: #2980b9; }
.status-badge.type-videogame { background: #e74c3c; }
.status-badge.type-series, .status-badge.type-season { background: #9b59b6; }
.status-badge.type-book { background: #16a085; }
.status-badge.finished { background: #2ecc71; }
.status-badge.in_progress { background: #f39c12; }
.status-badge.paused { background: #34495e; }
.status-badge.dropped { background: #c0392b; }
.taxonomy-group { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.platform-badge { border: 1px solid var(--line); border-radius: 6px; padding: 4px 10px; font-size: 0.9rem; font-weight: 600; }
.tag-link { font-size: 0.85rem; color: var(--primary); opacity: 0.8; }
.external-link { font-weight: 600; margin-right: 12px; }
.media-rewatches ul { margin: 4px 0 0; padding-left: 20px; }
.media-synopsis { margin: 16px 0 26px; max-width: 800px; font-size: 0.95rem; }
.media-synopsis summary { cursor: pointer; opacity: 0.7; }
.synopsis-label { font-weight: 700; }
.synopsis-full { margin: 8px 0 0; line-height: 1.6; opacity: 0.9; }
.review { max-width: 800px; }
.review img { border-radius: 6px; }
.review blockquote { margin-left: 0; padding-left: 16px; border-left: 3px solid var(--line); color: var(--secondary); }
.review pre { overflow-x: auto; background: var(--card); padding: 12px; border-radius: 6px; }
.media-relations { margin-top: 40px; }
.media-relations-title { font-size: 1.2rem; }
.media-grid-single { grid-template-columns: minmax(160px, 200px); }
@media (max-width: 700px) {
  .media-info-container, .media-simple-header { flex-direction: column; align-items: center; margin-top: -60px; padding: 0 10px; text-align: center; }
  .media-simple-header { margin-top: 0; }
  .media-info-container .media-details { padding-top: 10px; }
  .media-cover, .media-simple-header .media-cover { width: 160px; }
  .header-title { font-size: 2rem; }
  .media-meta { justify-content: center; }
  .year-title { font-size: 2rem; }
}
`;
