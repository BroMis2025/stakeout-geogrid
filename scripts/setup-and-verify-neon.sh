#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${NEON_ORG_ID:?Set the Neon organization ID}"
: "${NEON_PROJECT_ID:?Set the Neon project ID}"
: "${NEON_BRANCH:?Set the intended branch name}"
npm ci --include=dev
if command -v neon >/dev/null; then cli=(neon); else cli=(npx --yes neon@latest); fi
"${cli[@]}" init -y --org-id "$NEON_ORG_ID" --project-id "$NEON_PROJECT_ID" --branch "$NEON_BRANCH" --services postgres
"${cli[@]}" deploy
envfile=.env.local
[[ -f "$envfile" ]] || envfile=.env
[[ -f "$envfile" ]] || { echo 'Neon did not write an environment file.'; exit 1; }
node --env-file="$envfile" node_modules/prisma/build/index.js migrate deploy --schema packages/db/prisma/schema.prisma
npm run build
node --env-file="$envfile" --import tsx scripts/verify-neon.ts
