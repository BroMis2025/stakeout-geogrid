# Source coverage and implementation decisions

The supplied PDF is an 87-page printout of an iterative conversation. Its title mentions Mac mini installation and `morluto/rea`. The body starts inside the Stakeout worker revision. The later deployment instructions move the system to the cloud. This repository reconstructs the application described in the body.

| PDF pages | Material reviewed | Result in this repository |
| --- | --- | --- |
| 1–11 | Daily/weekly publisher, two BullMQ workers, proxy ladder, R2 bundles, metrics, retries and refunds | `apps/worker/src`, `packages/core`. Durable scan rows bridge Postgres and Redis. Pin job IDs and financial transactions make retries idempotent. |
| 11–20 | Competitor leaderboard, CSV, AI-only competitors, shares and map projection | `CompetitorLeaderboard.tsx` and `GeoGridDashboard.tsx`. Includes completed-grid and AI-triggered denominators. |
| 20–35 | Synchronized maps, historical runs, relative ranks and AI changes, matched video drawer | `GeoGridCompareView.tsx`, comparison API, `/scans/compare`, `/share/compare`. Rows/columns are compared within the same grid geometry and campaign. |
| 35–41 | SaaS workflow, monorepo, schema, PayPal, Upstash, private infrastructure, Mac and cloud deployment | Workspaces, migration, Codespace, Dockerfile, Vercel/Railway config, billing and cloud runbook. |
| 41–45 | Neon CLI, declarative config, Prisma adapter, verification | `neon.ts`, pooled/direct URLs, shared database package and verification scripts. |
| 45–60 | Next.js foundations, wizard, market/ISP fields, account-scoped scans, corrected routes | Root layout, Tailwind, `/new-scan`, `/api/user/me`, scan list, private API and optional desktop route. |
| 60–69 | Login/registration, signed cookie, starter credits, navigation and sign-out | Scrypt hashes, expiring HMAC sessions, account-scoped queries, ledger grant and administrator provisioning. |
| 69–81 | Fleet role checks, import, Android bootstrap, leases and cooldown controls | Fleet API and page, `packages/core/runner.ts`, device lease heartbeat and hardware verification. |
| 81–86 | Public lead-gen teaser and marketing homepage | Free fixed 3×3, lead email, daily limits, receipt-backed public report and signup route. |
| 86–87 | Video placement note and final print footer | The export supplies no carousel video URL or media file. Real pin recordings appear in the report viewers. |

## Where the snippets needed reconciliation

- The PDF gives some modules only as imports and clips the right edge of several code lines. Supporting XML parsing, hardware leasing, Postgres/Redis reconciliation, ZIP lookups, scan detail pages, PayPal routes and proof authorization are implemented in this repo.
- Private scan queries derive ownership from a signed session. Public sharing requires an owner-generated revocable token. A teaser receives its own public token. Private and public comparison URLs occupy separate Next.js routes.
- Passwordless legacy users and public registration cannot assign themselves an administrator role. Rotate an old deployment's session secret at cutover.
- Postgres commits pins and the charge together. The worker publishes unqueued scans and recovers interrupted pin delivery. R2 artifacts use attempt-specific keys and temporary signed read URLs. A public report exposes the video and a reduced proxy proof. Raw XML and receipt files are owner-only.
- The mobile worker binds the location and proxy through DuoPlus and matches the profile to the model actually read from Android during bootstrap. Proxy-check proof records the reported exit. The nearest US ZIP centroid is an estimate of the pin's postal market.
- The standard device flow uploads directly through its configured network. The optional proxy-unbind branch waits for a finished archive, detaches for transfer and restores the binding before releasing the lease. The compatibility of an empty proxy ID must be checked on a dedicated staging image.
- The free teaser stores the submitted email and shows a live report before signup. One-time pack prices, credential values, merchant identifiers and target infrastructure remain operator settings.

## Provider references used when reconciling the snippets

- [DuoPlus API authentication and rate limits](https://help.duoplus.net/docs/Introduction), [parameter updates](https://help.duoplus.net/docs/Batch-Modify-Parameters), [proxy checks](https://help.duoplus.net/docs/Check-Proxy), [ADB command responses](https://help.duoplus.net/docs/execute-the-adb-command/)
- [Proxy-Seller targeting suffixes and port](https://docs.proxy-seller.com/api-v2/residential-proxy/connect-target-via-login)
- [Neon declarative configuration](https://neon.com/blog/introducing-neon-ts)
- [PayPal Orders v2 purchase units](https://developer.paypal.com/api/orders/v2/definitions/purchase_unit)
- [CloakBrowser Python API](https://github.com/CloakHQ/CloakBrowser)
