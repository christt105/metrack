/**
 * Parent environment variables Hugo needs: paths, locale, its own `HUGO_*` settings, the Go module
 * toolchain used by the theme, git, proxies and CAs. Credentials of the server never reach it.
 */
export const HUGO_INHERITED_ENV: readonly string[] = [
  'PATH',
  'HOME',
  'TMPDIR',
  'LANG',
  'TZ',
  'XDG_CONFIG_HOME',
  'XDG_CACHE_HOME',
  'HUGO_*',
  'GOPATH',
  'GOROOT',
  'GOCACHE',
  'GOMODCACHE',
  'GOFLAGS',
  'GOPROXY',
  'GOPRIVATE',
  'GONOPROXY',
  'GONOSUMDB',
  'GOSUMDB',
  'GOTOOLCHAIN',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
];
