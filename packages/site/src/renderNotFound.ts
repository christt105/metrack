import { assetPath } from './sitePaths.js';

/** The page every missing public address answers with, the same whatever is missing. */
export function renderNotFound(): string {
  return `<!DOCTYPE html>
<html lang="es" class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>No encontrado</title>
<link href="${assetPath('theme.css')}" rel="stylesheet">
<meta name="color-scheme" content="light dark">
</head>
<body data-theme="dark">
<div class="wrapper"><main aria-label="Content"><h1>No encontrado</h1><p>Esta página no existe.</p></main></div>
</body>
</html>
`;
}
