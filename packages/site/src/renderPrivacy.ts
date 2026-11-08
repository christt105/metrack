import { escapeHtml } from '@metrack/export';
import type { PrivacyOptions } from './PrivacyOptions.js';
import { assetPath } from './sitePaths.js';

const TMDB_LOGO =
  'https://www.themoviedb.org/assets/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg';

/** The privacy page: what is stored and where, why, how to export and delete it, how long it is kept, and the data sources' credits. */
export function renderPrivacy(options: PrivacyOptions): string {
  const email = escapeHtml(options.contactEmail);
  const body = `<main>
<h1>Privacy</h1>
<p>metrack is a personal media tracker for movies, series, games and books. This page says what it keeps about you and what you can do with it.</p>

<h2>What is stored</h2>
<ul>
<li>Your account: a name and, if one was given when the account was created, an email address.</li>
<li>What you track: titles with their status, dates, ratings, reviews, notes, tags and the edits you made to them, plus the titles you follow for release alerts and the alerts already sent.</li>
<li>Your settings: your public page handle and whether the page is on, and the Jellyfin account name, notification topic and similar fields the owner may have set for you.</li>
<li>Your API tokens: name, access level and dates. Only a one-way hash of each token is stored.</li>
<li>Your sign-in sessions, kept in a cookie that only keeps you signed in. There is no advertising, analytics or tracking.</li>
<li>Images you uploaded.</li>
</ul>
<p>The information about each title (name, synopsis, cast, release dates, standard covers) comes from public providers and sits in a catalog shared by everyone; it is not personal data. If you switch your public page on, your library, ratings and public reviews are visible at <code>/u/&lt;handle&gt;/</code> to anyone with the address, and that page is off until you turn it on.</p>

<h2>Where</h2>
<p>Today metrack runs on a server at the home of the person who operates it, with backups on that server and on a second disk in the same place. The operator plans to move it to Cloudflare; this page will be updated when that happens.</p>

<h2>Why</h2>
<p>Only to run the tracker for you. Nothing is sold or shared for advertising. When you search for or add a title, its name and identifiers are sent to the data providers listed below. Covers from TMDB, Steam and IGDB are loaded by your browser straight from their servers, which therefore see your IP address.</p>

<h2>Your data</h2>
<ul>
<li>Export: Settings has a button that downloads a ZIP with all your data as JSON and the images you own. The same ZIP is available from the API at <code>GET /api/account/export</code>.</li>
<li>Delete: Settings has a button to delete your account, confirmed by typing your handle or the word <em>delete</em>. Deleting needs the browser session; an API token cannot do it.</li>
</ul>
<p>Deleting is not immediate. Your request waits 7 days; if you sign in during that time you see a notice and can cancel. After that, your account and everything personal in it is erased, including the images only you owned. Items you added by hand to the catalog (fan games and similar) are not deleted: they stay and pass to the owner of the instance. The shared catalog entries from providers stay too.</p>

<h2>How long it is kept</h2>
<p>Your data stays while your account exists, plus the 7 days between asking for deletion and its erasure. Backups are taken daily; 14 are kept on the server and 14 on the second disk, so what you deleted disappears from the backups once they rotate, about 14 days after the erasure and about 21 days after your request.</p>

<h2>Contact</h2>
<p>For questions or requests about your data, write to <a href="mailto:${email}">${email}</a>.</p>

<h2>Credits</h2>
<p><a href="https://www.themoviedb.org/" rel="noopener"><img src="${TMDB_LOGO}" alt="TMDB" height="16"></a> This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
<ul>
<li>Game data comes from <a href="https://www.igdb.com/" rel="noopener">IGDB</a>, a Twitch company, using the Twitch API.</li>
<li>Book data and covers come from <a href="https://openlibrary.org/" rel="noopener">Open Library</a>, a project of the Internet Archive.</li>
<li>Game artwork comes from <a href="https://www.steamgriddb.com/" rel="noopener">SteamGridDB</a> and its contributors, and from <a href="https://store.steampowered.com/" rel="noopener">Steam</a>; Steam and its logos are trademarks of Valve Corporation.</li>
<li>Some series artwork comes from <a href="https://thetvdb.com/" rel="noopener">TheTVDB</a>. Metadata provided by TheTVDB; please consider adding missing information or subscribing.</li>
</ul>
</main>`;
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light dark">
<title>Privacy</title>
<link href="${assetPath('theme.css')}" rel="stylesheet">
</head>
<body data-theme="dark">
<div style="max-width: 760px; margin: 0 auto; padding: 20px">
${body}
<p><small>Served by metrack</small></p>
</div>
</body>
</html>
`;
}
