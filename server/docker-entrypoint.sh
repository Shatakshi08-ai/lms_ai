#!/bin/sh
set -e
mkdir -p /app/server/uploads/covers /app/server/private-pdfs
# Named volumes are often root-owned on first mount; keep writable for the app.
chown -R node:node /app/server/uploads /app/server/private-pdfs 2>/dev/null || true
if [ "$(id -u)" = "0" ]; then
  exec su-exec node "$@"
fi
exec "$@"
