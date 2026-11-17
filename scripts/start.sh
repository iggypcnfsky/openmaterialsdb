#!/bin/sh
# Container entrypoint: apply migrations, (re)seed from data/ unless SEED_ON_START=false, then start Next.js.
set -e
node scripts/migrate.mjs
if [ "${SEED_ON_START:-true}" != "false" ]; then node scripts/seed.mjs; fi
exec node server.js
