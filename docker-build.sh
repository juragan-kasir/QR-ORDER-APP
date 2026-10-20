#!/usr/bin/env bash
# Build and (re)start the BISA-MAKAN (QR order) container on
# http://localhost:5173 — the port the BE CORS allow-list accepts locally for
# the order app.
#   ./docker-build.sh                                           → production API
#   VITE_API_BASE_URL=https://other-api.example ./docker-build.sh
# VITE_* values are baked in at build time, so changing them needs a rebuild.
# A localhost API is refused by vite.config.ts for production builds — use
# `npm run dev` against a local BE instead.
set -euo pipefail
cd "$(dirname "$0")"

API="${VITE_API_BASE_URL:-https://api-bisa-nota.vercel.app}"

echo "Building bisa-makan (API: $API)"
docker build -t bisa-makan --build-arg VITE_API_BASE_URL="$API" .

docker rm -f bisa-makan >/dev/null 2>&1 || true
docker run -d --name bisa-makan -p 5173:80 bisa-makan >/dev/null

# wait for nginx to answer (up to ~10 s), then confirm the API URL really is
# in the bundle
for _ in $(seq 1 20); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/)" = "200" ] && break
  sleep 0.5
done
entry="$(curl -s http://localhost:5173/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1 || true)"
if [ -n "$entry" ] && curl -s "http://localhost:5173$entry" | grep -F "$API" >/dev/null; then
  echo "OK: running on http://localhost:5173 (API $API)"
else
  echo "WARNING: could not confirm the API URL in the bundle — check docker logs bisa-makan"
fi
