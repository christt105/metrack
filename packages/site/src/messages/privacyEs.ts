/** The Spanish privacy page body. */
export const privacyEs = (email: string, tmdbLogo: string): string =>
  `<main>
<h1>Privacidad</h1>
<p>metrack es un registro personal de películas, series, juegos y libros. Esta página explica qué guarda sobre ti y qué puedes hacer con ello.</p>

<h2>Qué se guarda</h2>
<ul>
<li>Tu cuenta: un nombre y, si se indicó al crearla, una dirección de correo electrónico. Si inicias sesión con Google, también se guarda el identificador de tu cuenta de Google. Si te uniste mediante un enlace de invitación, se guarda además la dirección de correo que Google verificó para tu cuenta de Google, junto con la invitación que usaste, para que el propietario pueda saber a quién corresponde cada cuenta; tu correo también se usa para encontrar tu cuenta cuando inicias sesión. El inicio de sesión con Google solo crea una cuenta con un enlace de invitación que siga siendo válido.</li>
<li>Lo que registras: títulos con su estado, fechas, notas, reseñas, anotaciones, etiquetas y las ediciones que hiciste en ellos, además de los títulos que sigues para recibir avisos de estreno y los avisos ya enviados.</li>
<li>Tus ajustes: el nombre de usuario de tu página pública y si la página está activada, y el nombre de cuenta de Jellyfin, el tema de notificaciones y campos similares que el propietario haya configurado para ti.</li>
<li>Tus tokens de API: nombre, nivel de acceso y fechas. De cada token solo se guarda un hash irreversible.</li>
<li>Tus sesiones de inicio de sesión, guardadas en una cookie que solo sirve para mantenerte conectado. No hay publicidad, analítica ni seguimiento.</li>
<li>Las imágenes que subiste.</li>
</ul>
<p>La información de cada título (nombre, sinopsis, reparto, fechas de estreno, carátulas estándar) procede de proveedores públicos y está en un catálogo compartido por todos; no son datos personales. Si activas tu página pública, tu biblioteca, tus notas y tus reseñas públicas son visibles en <code>/u/&lt;nombre de usuario&gt;/</code> para cualquiera que tenga la dirección, y esa página permanece desactivada hasta que la actives.</p>

<h2>Dónde</h2>
<p>Hoy metrack funciona en un servidor en casa de la persona que lo gestiona, con copias de seguridad en ese servidor y en un segundo disco del mismo lugar. El gestor prevé trasladarlo a Cloudflare; esta página se actualizará cuando eso ocurra.</p>

<h2>Para qué</h2>
<p>Solo para que el registro funcione para ti. No se vende nada ni se comparte con fines publicitarios. Cuando buscas o añades un título, su nombre e identificadores se envían a los proveedores de datos indicados más abajo. Las carátulas de TMDB, Steam e IGDB las carga tu navegador directamente desde sus servidores, que por tanto ven tu dirección IP.</p>

<h2>Tus datos</h2>
<ul>
<li>Exportar: en Ajustes hay un botón que descarga un ZIP con todos tus datos en JSON y las imágenes que te pertenecen. El mismo ZIP está disponible desde la API en <code>GET /api/account/export</code>.</li>
<li>Eliminar: en Ajustes hay un botón para eliminar tu cuenta, que se confirma escribiendo tu nombre de usuario o la palabra <em>delete</em>. Para eliminarla hace falta la sesión del navegador; un token de API no puede hacerlo.</li>
</ul>
<p>La eliminación no es inmediata. Tu solicitud espera 7 días; si inicias sesión durante ese tiempo verás un aviso y podrás cancelarla. Pasado ese plazo, tu cuenta y todo lo personal que contiene se borran, incluidas las imágenes que solo eran tuyas. Los elementos que añadiste a mano al catálogo (juegos de aficionados y similares) no se eliminan: se conservan y pasan al propietario de la instancia. Las entradas del catálogo compartido procedentes de proveedores también se conservan.</p>

<h2>Cuánto tiempo se conserva</h2>
<p>Tus datos se conservan mientras exista tu cuenta, más los 7 días entre la solicitud de eliminación y el borrado. Las copias de seguridad se hacen a diario; se conservan 14 en el servidor y 14 en el segundo disco, de modo que lo que eliminaste desaparece de las copias cuando estas se renuevan, unos 14 días después del borrado y unos 21 días después de tu solicitud.</p>

<h2>Contacto</h2>
<p>Para dudas o solicitudes sobre tus datos, escribe a <a href="mailto:${email}">${email}</a>.</p>

<h2>Créditos</h2>
<p><a href="https://www.themoviedb.org" rel="noopener"><img src="${tmdbLogo}" alt="TMDB" height="16"></a> This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.</p>
<ul>
<li>Los datos de juegos proceden de <a href="https://www.igdb.com/" rel="noopener">IGDB</a>, una empresa de Twitch, mediante la API de Twitch.</li>
<li>Los datos y las portadas de libros proceden de <a href="https://openlibrary.org/" rel="noopener">Open Library</a>, un proyecto de Internet Archive.</li>
<li>Las ilustraciones de juegos proceden de <a href="https://www.steamgriddb.com/" rel="noopener">SteamGridDB</a> y sus colaboradores, y de <a href="https://store.steampowered.com/" rel="noopener">Steam</a>; Steam y sus logotipos son marcas comerciales de Valve Corporation.</li>
<li>Parte de las ilustraciones de series proceden de <a href="https://thetvdb.com/" rel="noopener">TheTVDB</a>. Metadatos proporcionados por TheTVDB; considera añadir la información que falte o suscribirte.</li>
</ul>
</main>`;
