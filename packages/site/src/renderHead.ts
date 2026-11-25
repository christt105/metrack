import { escapeHtml } from '@metrack/export';
import { assetPath } from './sitePaths.js';

/** The start of every public document up to the opening of the body: the shared stylesheet, font and icon, and the shared script unless `script` is false. */
export function renderHead(lang: string, title: string, extra = '', script = true): string {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#161c1a">
<title>${escapeHtml(title)}</title>
${extra}<link rel="preload" href="${assetPath('fonts/host-grotesk-latin.woff2')}" as="font" type="font/woff2" crossorigin>
<link href="${assetPath('site.css')}" rel="stylesheet">
<link rel="icon" type="image/svg+xml" href="${assetPath('favicon.svg')}">
${script ? `<script src="${assetPath('site.js')}" defer></script>\n` : ''}</head>
`;
}
