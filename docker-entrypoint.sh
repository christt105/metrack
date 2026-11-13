#!/bin/sh
if [ "$1" = "connector" ]; then
  shift
  exec node --disable-warning=ExperimentalWarning apps/server/dist/cli.js connector "$@"
fi
exec "$@"
