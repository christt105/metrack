import type { ThemeType } from '../themeType.js';

const TMDB_NOTICE =
  'This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.';

/** The Spanish texts of the public pages. */
export const es = {
  lang: 'es',
  collation: 'es',
  typeLabels: {
    movie: 'Película',
    tv: 'Serie',
    season: 'Temporada',
    videogame: 'Juego',
    book: 'Libro',
  } satisfies Record<ThemeType, string>,
  typePlurals: {
    movie: 'Películas',
    tv: 'Series',
    season: 'Temporadas',
    videogame: 'Juegos',
    book: 'Libros',
  } satisfies Record<ThemeType, string>,
  statusLabels: {
    finished: 'Completado',
    in_progress: 'En curso',
    paused: 'En pausa',
    dropped: 'Abandonado',
    not_started: 'Pendiente',
  } as Record<string, string>,
  ratingLabels: {
    crown: 'Obra maestra',
    heart: 'Increíble',
    thumbsUp: 'Bueno',
    smile: 'Decente',
    thumbsDown: 'Malo',
    dizzy: 'Terrible',
    skull: 'Abismal',
  },
  months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  seasonNumber: (number: number): string => `Temporada ${number}`,
  menu: {
    library: 'Biblioteca',
    collage: 'Collage',
    stats: 'Estadísticas',
    about: 'Acerca de',
    icon: 'Menu',
  },
  footer: {
    rss: 'Rss',
    servedBy: (link: string): string => `Servido por ${link}.`,
    tmdbNotice: TMDB_NOTICE,
    toTop: 'Ir arriba',
  },
  home: {
    emptyLibrary: 'Esta biblioteca está vacía.',
    noneCompleted: 'Aún no hay elementos completados.',
    unknownYear: 'No recuerdo cuándo',
    completed: 'Completado',
    setAside: (count: number): string => `Ver en pausa y abandonados (${count})`,
  },
  filter: {
    all: 'Todos',
    platforms: 'Plataformas',
    tags: 'Etiquetas',
    more: 'Más',
    search: 'Buscar por título o género...',
    noResults: 'No hay resultados.',
  },
  card: {
    hasReview: 'Contiene reseña/notas personales',
  },
  detail: {
    developer: 'Desarrollador:',
    author: 'Autor:',
    rewatches: 'Rewatches:',
    seasons: 'Temporadas',
    series: 'Serie',
    synopsis: 'Sinopsis',
    banner: 'Banner',
  },
  feed: {
    title: (handle: string): string => `Completados · @${handle}`,
    description: (handle: string): string => `Elementos completados por @${handle}`,
    ratingNote: (rating: number, label: string): string => `Nota: ${rating} (${label})`,
  },
  stats: {
    title: 'Estadísticas',
    total: 'Total',
    finished: 'Completados',
    averageRating: 'Nota media',
    ratingDistribution: 'Distribución de notas',
    finishedPerYear: 'Completados por año',
    averageRatingPerYear: 'Nota media por año',
    topGenres: 'Géneros más frecuentes',
    yearSelector: 'Completados por año:',
    allYears: 'Todos',
    platforms: 'Plataformas de juego',
    animeContent: 'Contenido anime',
    anime: 'Anime',
    nonAnime: 'Non-anime',
    cinemaVsStreaming: 'Cine vs. Streaming',
    cinema: 'Cinema',
    streaming: 'Streaming / Home',
  },
  collage: {
    title: 'Collage',
    hideControls: 'Hide Controls',
    settings: 'Collage Settings',
    from: 'From:',
    to: 'To:',
    type: 'Type:',
    movies: 'Movies',
    series: 'Series',
    games: 'Games',
    books: 'Books',
    columns: 'Columns:',
    itemsFound: 'Items found:',
    download: 'Download PNG',
  },
  notFound: {
    title: 'No encontrado',
    body: 'Esta página no existe.',
  },
  privacy: {
    lang: 'en',
    title: 'Privacy',
    servedBy: 'Served by metrack',
    body: (email: string, tmdbLogo: string): string =>
      `<main>
<h1>Privacy</h1>
<p>metrack is a personal media tracker for movies, series, games and books. This page says what it keeps about you and what you can do with it.</p>

<h2>What is stored</h2>
<ul>
<li>Your account: a name and, if one was given when the account was created, an email address. If you sign in with Google, the identifier of your Google account is stored too. If you joined through an invitation link, the email address Google verified for your Google account is stored as well, together with the invitation you used, so the owner can tell who each account belongs to; your email address is also used to find your account when you sign in. Google sign-in creates an account only for an invitation link that is still valid.</li>
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
<p><a href="https://www.themoviedb.org" rel="noopener"><img src="${tmdbLogo}" alt="TMDB" height="16"></a> This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.</p>
<ul>
<li>Game data comes from <a href="https://www.igdb.com/" rel="noopener">IGDB</a>, a Twitch company, using the Twitch API.</li>
<li>Book data and covers come from <a href="https://openlibrary.org/" rel="noopener">Open Library</a>, a project of the Internet Archive.</li>
<li>Game artwork comes from <a href="https://www.steamgriddb.com/" rel="noopener">SteamGridDB</a> and its contributors, and from <a href="https://store.steampowered.com/" rel="noopener">Steam</a>; Steam and its logos are trademarks of Valve Corporation.</li>
<li>Some series artwork comes from <a href="https://thetvdb.com/" rel="noopener">TheTVDB</a>. Metadata provided by TheTVDB; please consider adding missing information or subscribing.</li>
</ul>
</main>`,
  },
};
