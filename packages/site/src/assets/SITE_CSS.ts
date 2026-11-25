/** The stylesheet of the public pages, without the rating colours `siteStylesheet` adds. */
export const SITE_CSS = String.raw`@font-face {
  font-family: 'Host Grotesk';
  font-style: normal;
  font-weight: 400 700;
  font-display: optional;
  src: url('fonts/host-grotesk-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: 'Host Grotesk';
  font-style: normal;
  font-weight: 400 700;
  font-display: optional;
  src: url('fonts/host-grotesk-latin-ext.woff2') format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}

:root {
  color-scheme: dark;
  --bg: #161c1a;
  --surface-low: #1f2725;
  --surface-high: #28312e;
  --surface-highest: #323c39;
  --on-surface: #e3e2da;
  --muted: #8e948d;
  --outline: rgba(227, 226, 218, 0.13);
  --outline-strong: rgba(227, 226, 218, 0.26);
  --primary: #9fc7b8;
  --on-primary: #161c1a;
  --primary-hover: #b9d8cc;
  --trophy: #f2c230;
  --status-in_progress: #9fc7b8;
  --status-paused: #dcb86d;
  --status-dropped: #e8a39a;
  --status-finished: #c3d29a;
  --status-not_started: #8e948d;
  --r-sm: 10px;
  --r-md: 16px;
  --r-lg: 24px;
  --s-1: 4px;
  --s-2: 8px;
  --s-3: 12px;
  --s-4: 16px;
  --s-5: 24px;
  --s-6: 32px;
  --s-7: 48px;
  --s-8: 64px;
  --t-h1: clamp(28px, 1.6vw + 20px, 40px);
  --header: calc(65px + env(safe-area-inset-top, 0px));
  --wrap: 1280px;
  --gut: 32px;
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-enter: cubic-bezier(0.22, 1, 0.36, 1);
  font-family: 'Host Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-tap-highlight-color: transparent;
}

@media (max-width: 759px) {
  :root {
    --header: calc(93px + env(safe-area-inset-top, 0px));
    --gut: 16px;
  }

  :root:has(.site-header-inner-home) {
    --header: calc(53px + env(safe-area-inset-top, 0px));
  }
}

* {
  box-sizing: border-box;
}

html {
  scroll-padding-top: calc(var(--header) + 56px);
}

html,
body {
  margin: 0;
  overflow-x: clip;
}

body {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--on-surface);
  font-variant-numeric: tabular-nums;
}

body > main {
  flex: 1 0 auto;
}

img {
  max-width: 100%;
}

a {
  color: var(--primary);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

h1,
h2,
h3 {
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.15;
  text-wrap: balance;
  margin: 0;
}

p {
  margin: 0;
}

[hidden] {
  display: none !important;
}

button,
input,
select {
  font: inherit;
  color: inherit;
}

.icon {
  flex: none;
  display: block;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sprite {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.wrap {
  width: 100%;
  max-width: var(--wrap);
  margin: 0 auto;
  padding: 0 var(--gut);
}

.wrap.narrow {
  max-width: 760px;
}

.page {
  padding-top: var(--s-7);
  padding-bottom: var(--s-7);
}

.page h1 {
  font-size: var(--t-h1);
  margin-bottom: var(--s-4);
}

.empty,
.note {
  color: var(--muted);
}

.count {
  color: var(--muted);
  font-weight: 400;
  font-size: 0.8em;
  margin-left: var(--s-1);
}

.section-title {
  font-size: 22px;
  margin-bottom: var(--s-4);
}

/* Header */

.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(22, 28, 26, 0.86);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border-bottom: 1px solid var(--outline);
  padding-top: env(safe-area-inset-top, 0px);
}

.site-header-inner {
  max-width: var(--wrap);
  margin: 0 auto;
  padding: 0 var(--gut);
  height: 64px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: var(--s-4);
}

.site-header-inner-home {
  grid-template-columns: minmax(0, 1fr) auto;
}

.site-brand {
  display: inline-flex;
  align-items: center;
  gap: var(--s-3);
  min-width: 0;
  color: var(--on-surface);
  font-weight: 600;
}

.site-brand:hover {
  text-decoration: none;
}

.site-brand-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--surface-high);
}

.site-brand-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.site-nav {
  display: flex;
  gap: var(--s-1);
}

.site-nav-link {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 var(--s-4);
  border-radius: 999px;
  color: var(--muted);
  font-weight: 500;
  white-space: nowrap;
  transition: color 150ms var(--ease), background-color 150ms var(--ease);
}

.site-nav-link:hover {
  color: var(--on-surface);
  background: var(--surface-low);
  text-decoration: none;
}

.site-nav-link[aria-current='page'] {
  color: var(--on-surface);
  background: var(--surface-high);
}

.site-feed {
  justify-self: end;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--muted);
  transition: color 150ms var(--ease), background-color 150ms var(--ease);
}

.site-feed:hover {
  color: var(--on-surface);
  background: var(--surface-low);
}

@media (max-width: 759px) {
  .site-header-inner {
    height: auto;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: 48px 44px;
    grid-template-areas: 'brand feed' 'nav nav';
    row-gap: 0;
  }

  .site-header-inner-home {
    grid-template-rows: 52px;
    grid-template-areas: 'nav feed';
  }

  .site-header-inner-home .site-nav {
    -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
    mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
  }

  .site-brand {
    grid-area: brand;
  }

  .site-feed {
    grid-area: feed;
  }

  .site-nav {
    grid-area: nav;
    overflow-x: auto;
    scrollbar-width: none;
    align-items: center;
    margin: 0 calc(-1 * var(--gut));
    padding: 0 var(--gut);
  }

  .site-nav::-webkit-scrollbar {
    display: none;
  }

  .site-nav-link {
    min-height: 36px;
    padding: 0 var(--s-3);
  }
}

/* Footer */

.site-footer {
  margin-top: var(--s-8);
  border-top: 1px solid var(--outline);
  color: var(--muted);
  font-size: 14px;
}

.site-footer-inner {
  max-width: var(--wrap);
  margin: 0 auto;
  padding: var(--s-5) var(--gut) calc(var(--s-5) + env(safe-area-inset-bottom, 0px));
  display: grid;
  gap: var(--s-2);
}

.site-credits {
  font-size: 12px;
}

.site-credits img {
  vertical-align: middle;
  margin-right: var(--s-2);
}

/* Chips, pills and buttons */

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--outline);
  background: var(--surface-low);
  color: var(--on-surface);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 150ms var(--ease), border-color 150ms var(--ease), color 150ms var(--ease), transform 90ms var(--ease);
}

.chip:hover {
  border-color: var(--outline-strong);
  background: var(--surface-high);
  text-decoration: none;
}

.chip:active {
  transform: scale(0.97);
}

.chip[aria-pressed='true'] {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--on-primary);
}

.chip-rating {
  color: var(--rating);
  padding: 0 10px;
}

.chip-rating[aria-pressed='true'] {
  background: var(--rating);
  border-color: var(--rating);
  color: #fff;
}

.chip-link {
  color: var(--on-surface);
}

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--surface-high);
  font-size: 14px;
  font-weight: 500;
}

.pill[class*='status-']::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--status, var(--muted));
}

.status-finished { --status: var(--status-finished); }
.status-in_progress { --status: var(--status-in_progress); }
.status-paused { --status: var(--status-paused); }
.status-dropped { --status: var(--status-dropped); }
.status-not_started { --status: var(--status-not_started); }

.pill-rating {
  background: var(--rating);
  color: #fff;
}

.pill-trophy {
  background: var(--trophy);
  color: #3a2a00;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  min-height: 44px;
  padding: 0 var(--s-5);
  border: 0;
  border-radius: var(--r-sm);
  background: var(--primary);
  color: var(--on-primary);
  font-weight: 600;
  cursor: pointer;
  transition: background-color 150ms var(--ease), transform 90ms var(--ease);
}

.button:hover {
  background: var(--primary-hover);
}

.button:active {
  transform: scale(0.98);
}

.button:disabled {
  opacity: 0.5;
  cursor: default;
  transform: none;
}

.rating-text {
  color: var(--rating);
}

/* Profile */

.profile {
  position: relative;
  isolation: isolate;
  min-height: 440px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  background: radial-gradient(120% 120% at 20% 0%, #24302c 0%, var(--bg) 70%);
}

.profile-backdrop {
  position: absolute;
  inset: 0;
  z-index: -1;
}

.profile-backdrop img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 25%;
  opacity: 0;
  transition: opacity 600ms var(--ease-enter);
}

.profile-backdrop.is-loaded img {
  opacity: 1;
}

.profile-backdrop::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(22, 28, 26, 0) 0%, rgba(22, 28, 26, 0) 45%, rgba(22, 28, 26, 0.7) 80%, var(--bg) 100%);
}

.profile-inner {
  width: 100%;
  max-width: var(--wrap);
  margin: 0 auto;
  padding: var(--s-8) var(--gut) var(--s-6);
  display: flex;
  align-items: center;
  gap: var(--s-5);
}

.profile-avatar {
  flex: none;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--surface-high);
  box-shadow: 0 0 0 4px var(--bg), 0 12px 32px rgba(0, 0, 0, 0.4);
}

.profile-name {
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.55);
  font-size: clamp(24px, 1.2vw + 18px, 32px);
  letter-spacing: -0.035em;
}

.profile-bio {
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.6);
  margin-top: var(--s-2);
  max-width: 60ch;
  color: rgba(227, 226, 218, 0.82);
}

@media (max-width: 759px) {
  .profile {
    display: block;
    min-height: 0;
    background: none;
  }

  .profile-backdrop {
    position: relative;
    inset: auto;
    z-index: auto;
    aspect-ratio: 16 / 9;
  }

  .profile-inner {
    position: relative;
    margin-top: calc(-1 * var(--s-8));
    padding: 0 var(--gut) var(--s-5);
    gap: var(--s-4);
  }

  .profile-avatar {
    width: 56px;
    height: 56px;
  }
}

/* Home */

.home,
.completed,
.filter-bar,
.detail-body,
.stats [data-stats-year] {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.home {
  gap: var(--s-7);
}

.filter-bar {
  gap: var(--s-3);
}

.search {
  position: relative;
  display: flex;
  align-items: center;
  max-width: 560px;
}

.search .icon {
  position: absolute;
  left: 14px;
  color: var(--muted);
  pointer-events: none;
}

.search input {
  width: 100%;
  min-height: 48px;
  padding: 0 var(--s-4) 0 44px;
  border-radius: 999px;
  border: 1px solid var(--outline);
  background: var(--surface-low);
  font-size: 16px;
  transition: border-color 150ms var(--ease), box-shadow 150ms var(--ease);
}

.search input::placeholder {
  color: var(--muted);
}

.search input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(159, 199, 184, 0.2);
}

.filter-rows {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2) var(--s-5);
}

.filter-more summary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  list-style: none;
}

.filter-more summary::-webkit-details-marker {
  display: none;
}

.filter-more[open] summary {
  color: var(--on-surface);
}

.filter-more .chips {
  margin-top: var(--s-2);
}

.filter-empty {
  color: var(--muted);
}

@media (max-width: 759px) {
  .filter-rows {
    flex-direction: column;
    flex-wrap: nowrap;
  }

  .filter-rows .chips {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    margin: 0 calc(-1 * var(--gut));
    padding: 0 var(--gut);
  }

  .filter-rows .chips::-webkit-scrollbar {
    display: none;
  }
}

.completed {
  gap: var(--s-6);
}

.completed > .section-title {
  margin-bottom: calc(-1 * var(--s-4));
}

.year-nav {
  position: sticky;
  top: var(--header);
  z-index: 10;
  display: flex;
  gap: var(--s-1);
  overflow-x: auto;
  scrollbar-width: none;
  padding: var(--s-1);
  border: 1px solid var(--outline);
  border-radius: 999px;
  background: rgba(22, 28, 26, 0.9);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.year-nav::-webkit-scrollbar {
  display: none;
}

.year-nav-link {
  flex: none;
  padding: 6px 12px;
  border-radius: 999px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 500;
}

.year-nav-link:hover {
  color: var(--on-surface);
  background: var(--surface-low);
  text-decoration: none;
}

@media (max-width: 759px) {
  .year-nav {
    margin: 0 calc(-1 * var(--gut));
    padding: var(--s-1) var(--gut);
    border-width: 0 0 1px;
    border-radius: 0;
  }
}

.year-title {
  font-size: 18px;
  margin-bottom: var(--s-4);
}

.set-aside summary {
  min-height: 44px;
  display: flex;
  align-items: center;
  color: var(--muted);
  font-weight: 500;
  cursor: pointer;
}

.set-aside[open] summary {
  margin-bottom: var(--s-4);
}

.set-aside .group + .group {
  margin-top: var(--s-6);
}

/* Cards */

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--s-5) var(--s-4);
}

@media (max-width: 759px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    gap: var(--s-4) var(--s-3);
  }
}

.card-link {
  display: block;
  color: var(--on-surface);
}

.card-link:hover {
  text-decoration: none;
}

.card-poster {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: var(--r-sm);
  overflow: hidden;
  background: var(--surface-low);
  box-shadow: 0 0 0 1px var(--outline);
}

.card-poster img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 600ms var(--ease-enter);
}

.card-poster::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.35), transparent 30%);
  pointer-events: none;
}

@media (hover: hover) {
  .card-link:hover .card-poster img {
    transform: scale(1.04);
  }
}

.card-link:active .card-poster {
  transform: scale(0.98);
  transition: transform 90ms var(--ease);
}

.card-type,
.card-rating,
.card-mark {
  position: absolute;
  z-index: 1;
  display: grid;
  place-items: center;
  border-radius: 50%;
}

.card-type {
  top: 6px;
  left: 6px;
  width: 26px;
  height: 26px;
  background: rgba(22, 28, 26, 0.72);
  color: var(--on-surface);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.card-rating {
  top: 6px;
  right: 6px;
  width: 30px;
  height: 30px;
  background: var(--rating);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}

.card-marks {
  position: absolute;
  z-index: 1;
  left: 6px;
  bottom: 6px;
  display: flex;
  gap: 4px;
}

.card-mark {
  position: static;
  width: 24px;
  height: 24px;
  background: rgba(22, 28, 26, 0.72);
  color: var(--on-surface);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.card-trophy {
  background: var(--trophy);
  color: #3a2a00;
}

.card-title {
  margin-top: var(--s-2);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.3;
  letter-spacing: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-caption {
  margin-top: 2px;
  font-size: 13px;
  color: var(--muted);
}

/* Detail */

.detail-hero {
  position: relative;
  isolation: isolate;
  padding-top: var(--s-7);
}

.detail-hero.has-backdrop {
  padding-top: clamp(160px, 26vw, 340px);
}

.detail-backdrop {
  position: absolute;
  inset: 0 0 auto;
  z-index: -1;
  height: clamp(260px, 38vw, 520px);
  overflow: hidden;
}

.detail-backdrop img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 25%;
}

.detail-backdrop::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(22, 28, 26, 0) 30%, rgba(22, 28, 26, 0.7) 70%, var(--bg) 100%);
}

.detail-head {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: var(--s-6);
  align-items: end;
}

.detail-head.no-poster {
  grid-template-columns: minmax(0, 1fr);
}

.detail-poster {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: var(--r-md);
  background: var(--surface-low);
  box-shadow: 0 0 0 1px var(--outline), 0 24px 48px rgba(0, 0, 0, 0.45);
}

.detail-headline {
  display: grid;
  gap: var(--s-4);
  padding-bottom: var(--s-2);
}

.detail-title {
  font-size: clamp(32px, 2.6vw + 20px, 56px);
  letter-spacing: -0.035em;
}

.detail-credits {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2) var(--s-5);
  font-size: 15px;
}

.detail-credits div {
  display: flex;
  gap: 6px;
}

.detail-credits dt {
  color: var(--muted);
}

.detail-credits dd {
  margin: 0;
}

.detail-body {
  margin-top: var(--s-6);
  gap: var(--s-6);
}

.synopsis {
  max-width: 920px;
}

@media (max-width: 759px) {
  .detail-hero.has-backdrop {
    padding-top: 150px;
  }

  .detail-backdrop {
    height: 260px;
  }

  .detail-head {
    grid-template-columns: 112px minmax(0, 1fr);
    gap: var(--s-4);
    align-items: end;
  }

  .detail-headline {
    display: contents;
  }

  .detail-title {
    align-self: end;
    font-size: 26px;
  }

  .detail-headline > :not(.detail-title) {
    grid-column: 1 / -1;
  }

  .detail-head.no-poster .detail-headline {
    display: grid;
  }

  .detail-poster {
    border-radius: var(--r-sm);
  }
}

.synopsis {
  border-radius: var(--r-md);
  background: var(--surface-low);
  border: 1px solid var(--outline);
}

.synopsis summary {
  display: flex;
  gap: var(--s-3);
  align-items: baseline;
  padding: var(--s-4) var(--s-5);
  cursor: pointer;
  list-style: none;
}

.synopsis summary::-webkit-details-marker {
  display: none;
}

.synopsis-label {
  flex: none;
  font-weight: 600;
}

.synopsis-preview {
  min-width: 0;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.synopsis[open] .synopsis-preview {
  display: none;
}

.synopsis p {
  padding: 0 var(--s-5) var(--s-5);
  color: rgba(227, 226, 218, 0.85);
  max-width: 70ch;
}

.detail-section .grid {
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
}

@media (max-width: 759px) {
  .detail-section .grid {
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  }
}

.comments {
  min-height: 150px;
}

.giscus,
.giscus-frame {
  width: 100%;
}

.giscus-frame {
  border: none;
  color-scheme: normal;
}

/* Prose */

.prose {
  font-size: 17px;
  line-height: 1.7;
  max-width: 70ch;
}

.prose > * + * {
  margin-top: 1em;
}

.prose > :first-child {
  margin-top: 0;
}

.prose h1,
.prose h2,
.prose h3,
.prose h4 {
  margin-top: 1.6em;
}

.prose h1 { font-size: 30px; }
.prose h2 { font-size: 24px; }
.prose h3 { font-size: 20px; }
.prose h4 { font-size: 17px; }

.prose ul,
.prose ol {
  padding-left: 1.4em;
}

.prose li + li {
  margin-top: 0.3em;
}

.prose blockquote {
  margin-left: 0;
  margin-right: 0;
  padding: 2px 0 2px var(--s-5);
  border-left: 3px solid var(--primary);
  color: rgba(227, 226, 218, 0.85);
}

.prose blockquote > * + * {
  margin-top: 0.8em;
}

.prose hr {
  border: 0;
  border-top: 1px solid var(--outline);
}

.prose code {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.88em;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--surface-high);
}

.prose pre {
  overflow-x: auto;
  padding: var(--s-4);
  border-radius: var(--r-sm);
  background: var(--surface-low);
  border: 1px solid var(--outline);
}

.prose pre code {
  padding: 0;
  background: none;
}

.prose img {
  height: auto;
  border-radius: var(--r-sm);
}

/* Page headings */

.page-head {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: var(--s-4);
  padding-top: var(--s-7);
  margin-bottom: var(--s-6);
}

.page-head h1 {
  font-size: var(--t-h1);
  letter-spacing: -0.035em;
}

/* Statistics */

.year-select {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  color: var(--muted);
  font-size: 14px;
}

.year-select select {
  min-height: 40px;
  padding: 0 var(--s-6) 0 var(--s-3);
  border-radius: var(--r-sm);
  border: 1px solid var(--outline);
  background: var(--surface-low);
  color: var(--on-surface);
  font-size: 16px;
}

.stats [data-stats-year] {
  gap: var(--s-7);
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: var(--s-3);
}

.stats-section > .stat-cards + .note {
  margin-top: var(--s-3);
}

.stat-card {
  display: grid;
  gap: var(--s-1);
  padding: var(--s-4) var(--s-5);
  border-radius: var(--r-md);
  background: var(--surface-low);
  border: 1px solid var(--outline);
}

.stat-number {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.stat-number .icon {
  color: var(--primary);
}

.stat-max {
  color: var(--muted);
  font-size: 16px;
  font-weight: 400;
}

.stat-label {
  color: var(--muted);
  font-size: 14px;
}

.bars {
  display: grid;
  gap: var(--s-2);
}

.bar-row {
  display: grid;
  grid-template-columns: minmax(96px, 200px) minmax(0, 1fr) 56px;
  align-items: center;
  gap: var(--s-3);
  font-size: 14px;
}

.bar-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-track {
  display: block;
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: var(--surface-high);
  overflow: hidden;
}

.bar-fill:not([fill]) {
  fill: var(--primary);
}

.bar-value {
  text-align: right;
  font-weight: 600;
}

.stats-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--s-6);
  align-items: center;
}

.pie {
  display: flex;
  align-items: center;
  gap: var(--s-5);
}

.donut {
  width: 140px;
  height: 140px;
  flex: none;
}

.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
  font-size: 14px;
}

.legend li {
  display: flex;
  align-items: center;
  gap: var(--s-2);
}

.legend-dot {
  width: 10px;
  height: 10px;
  flex: none;
}

.legend-value {
  color: var(--muted);
  margin-left: auto;
  padding-left: var(--s-3);
}

@media (max-width: 759px) {
  .stat-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-number {
    font-size: 24px;
  }

  .bar-row {
    grid-template-columns: minmax(80px, 34%) minmax(0, 1fr) 48px;
  }

  .stats-split {
    grid-template-columns: minmax(0, 1fr);
  }

  .donut {
    width: 112px;
    height: 112px;
  }
}

/* Collage */

.collage {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: var(--s-6);
  align-items: start;
  padding-top: var(--s-6);
}

.collage-controls {
  position: sticky;
  top: calc(var(--header) + var(--s-4));
  padding: var(--s-5);
  border-radius: var(--r-md);
  background: var(--surface-low);
  border: 1px solid var(--outline);
}

.collage-controls summary {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-size: 18px;
  font-weight: 500;
  list-style: none;
  pointer-events: none;
}

.collage-controls summary::-webkit-details-marker {
  display: none;
}

.collage-fields {
  display: grid;
  gap: var(--s-4);
  margin-top: var(--s-5);
}

.field {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  border: 0;
  font-size: 14px;
  color: var(--muted);
}

.field legend {
  padding: 0;
  margin-bottom: 6px;
}

.field input[type='date'] {
  min-height: 44px;
  padding: 0 var(--s-3);
  border-radius: var(--r-sm);
  border: 1px solid var(--outline);
  background: var(--bg);
  color: var(--on-surface);
  font-size: 16px;
}

.field input[type='range'] {
  accent-color: var(--primary);
}

.field output {
  color: var(--on-surface);
  font-weight: 600;
}

.check {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  min-height: 32px;
  color: var(--on-surface);
}

.check input {
  width: 18px;
  height: 18px;
  accent-color: var(--primary);
}

.collage-count {
  color: var(--muted);
  font-size: 14px;
}

.collage-count strong {
  color: var(--on-surface);
}

.collage-preview {
  padding: var(--s-4);
  border-radius: var(--r-md);
  background: var(--surface-low);
  border: 1px solid var(--outline);
  min-height: 320px;
}

.collage-grid {
  display: grid;
  grid-template-columns: repeat(var(--columns, 5), minmax(0, 1fr));
  max-width: calc(var(--columns, 5) * 120px);
  margin: 0 auto;
}

.collage-grid img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  background: var(--surface-high);
}

@media (max-width: 899px) {
  .collage {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--s-4);
    padding-top: var(--s-4);
  }

  .collage-controls {
    position: static;
    padding: var(--s-4);
  }

  .collage-controls summary {
    pointer-events: auto;
    cursor: pointer;
    min-height: 32px;
  }

  .collage-preview {
    padding: var(--s-2);
  }

  .collage-grid {
    max-width: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0ms !important;
  }
}
`;
