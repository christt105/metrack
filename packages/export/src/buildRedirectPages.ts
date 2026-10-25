import { escapeHtml } from './escapeHtml.js';
import type { ExportedTextFile } from './ExportedTextFile.js';
import type { RedirectOptions } from './RedirectOptions.js';
import { redirectScript } from './redirectScript.js';

const DEFAULT_OLD_BASE = '/MediaTracker';

function page(newOrigin: string, oldBasePath: string): string {
  const root = escapeHtml(`${newOrigin}/`);
  return [
    '<!doctype html>',
    '<html lang="es">',
    '<head>',
    '<meta charset="utf-8">',
    '<title>Media Tracker se ha mudado</title>',
    `<link rel="canonical" href="${root}">`,
    `<meta http-equiv="refresh" content="0; url=${root}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<script>${redirectScript(newOrigin, oldBasePath)}</script>`,
    '</head>',
    '<body>',
    `<p>Media Tracker se ha mudado. <a href="${root}">Ir a la nueva direccion</a>.</p>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

/**
 * The only two files the old GitHub Pages site needs once the new site is live: `404.html` catches
 * every old address and `index.html` covers the root. Both send the visitor to the same path on
 * the new origin.
 */
export function buildRedirectPages(options: RedirectOptions): ExportedTextFile[] {
  const origin = options.newOrigin.replace(/\/+$/, '');
  if (!/^https?:\/\/[^/\s]+$/.test(origin)) {
    throw new Error(
      `The new origin must be an http(s) address without a path: ${options.newOrigin}`,
    );
  }
  const base = (options.oldBasePath ?? DEFAULT_OLD_BASE).replace(/\/+$/, '');
  const content = page(origin, base);
  return [
    { kind: 'text', path: '404.html', content },
    { kind: 'text', path: 'index.html', content },
  ];
}
