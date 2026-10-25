/**
 * The script of the redirect pages. It sends the visitor to the same path on the new origin and
 * points the canonical link at that exact address.
 */
export function redirectScript(newOrigin: string, oldBasePath: string): string {
  return [
    `var origin = ${safeJson(newOrigin)};`,
    `var base = ${safeJson(oldBasePath)};`,
    'var path = location.pathname;',
    "if (path === base || path.indexOf(base + '/') === 0) path = path.slice(base.length);",
    "if (path === '') path = '/';",
    'var target = origin + path + location.search + location.hash;',
    "var canonical = document.querySelector('link[rel=canonical]');",
    "if (canonical) canonical.setAttribute('href', origin + path);",
    'location.replace(target);',
  ].join('\n');
}

function safeJson(value: string): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}
