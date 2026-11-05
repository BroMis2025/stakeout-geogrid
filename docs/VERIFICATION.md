# Release verification

## Checks performed

| Check | Result |
| --- | --- |
| Production build | Prisma Client generated at 5.22.0, worker TypeScript check passed, Next.js 15.5.29 compiled the production app, type-checked routes and generated all 22 static-build entries. |
| Domain and capture tests | 9 passed. Coverage includes 3×3 and 11×11 geometry, validation, campaign identity, schedule expressions, metric denominators, scoped AI extraction, scroll deduplication, unknown-layout handling, challenge detection and shell quoting. |
| HTTP smoke tests | 30 passed against a running production Next.js server and isolated PGlite database over the PostgreSQL wire protocol. Exercised registration, invalid login and tampered cookie, agency and admin access (including the page-level 403), an 18-credit scan, an idempotent replay, insufficient funds, public teaser, sharing and revocation. |
| Database and ledger | The SQL schema was applied to the isolated database. An insert/read/delete transaction passed. The worker's settlement functions produced one terminal refund for repeated failed attempts, a partial 8/9 result and the correct aggregate. A repeated schedule occurrence produced one child run and one debit. Insufficient funds paused the template. |
| Payment fulfillment | Tested the real ledger transaction against a simulated PayPal order response. A mismatched amount was rejected and two deliveries of the same valid capture produced one credit grant. |
| Script syntax | Android shell passed `sh -n`, cloud setup passed `bash -n`, and the optional desktop runner passed Python compilation. |

No real customer data, Google results, paid captures or phone recordings were used in these checks. A successful application build does not establish live provider connectivity.

## Repeat the checks

```sh
npm ci
npm run db:generate
npm test
npm run build
```

Against a **fresh disposable migrated database** with both URLs exported:

```sh
node --import tsx scripts/verify-neon.ts
TEST_DISPOSABLE_DB=yes node --import tsx tests/ledger.integration.ts
```

For the HTTP checks, run the built web app against that disposable database with a test `AUTH_SECRET` and keep the worker stopped. Start the web server on port 3315, then run the Python check in a second Codespaces terminal. The HTTP suite creates dedicated test accounts and scans, including a teaser. Discard the test database after the run.

```sh
# Terminal A, from repo root
npm -w @stakeout/web run start -- -H 127.0.0.1 -p 3315
# Terminal B
TEST_DISPOSABLE_DB=yes python3 tests/http_smoke.py
```

The default database transport is the Neon serverless adapter. For plain PostgreSQL in a disposable environment, set `DB_TRANSPORT=tcp`.

## Live acceptance still required

Use the smoke test in [Cloud setup](CLOUD_SETUP.md) to verify your Neon branch, Redis queue and leases, DuoPlus image permissions and hardware profile, Proxy-Seller targeting, current Google UI layout, R2 bundle upload and video playback, and a PayPal sandbox purchase/webhook. Test the optional desktop browser separately if enabled. The release checks did not run a Docker image, inspect rendered maps in a browser, send jobs to a live fleet or deploy to Vercel/Railway.
