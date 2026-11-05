# Cloud setup and operations

## 1. Put the source in a private repository

Create or open your intended **private** repository in GitHub, open a Codespace, upload this ZIP and extract it there. Copy the contents of its `stakeout/` directory to the repository root, including the dotfiles, then commit the source. Check that the root contains `package.json`, `railway.json`, `apps/` and `packages/`. Choose Node 22.12 or later. The included devcontainer selects Node 22.

## 2. Provision Postgres and apply the schema

Use a new database or a disposable Neon branch for the first deployment. Save the pooled URL as `DATABASE_URL` and the direct URL as `DATABASE_URL_UNPOOLED`. Credentials belong in Codespaces secrets and the hosting providers' environment settings.

The PDF names Neon organization `org-damp-water-22701956`, project `raspy-cell-78931724`, and branch `production`. The repo takes the destination from your environment. Use your test branch name for the first run.

**Using Neon CLI in the Codespace**

```sh
export NEON_ORG_ID=your_org_id
export NEON_PROJECT_ID=your_project_id
export NEON_BRANCH=your_test_branch
bash scripts/setup-and-verify-neon.sh
```

Finish Neon sign-in in the browser if prompted. If the sign-in expires, run `npx neon@latest login` and retry. The script links the project, applies the Postgres configuration, uses Neon's generated environment file, runs the checked-in migration, builds the repo and verifies a database write/read/delete transaction. The CLI records project linkage separately from `neon.ts`.

**Using dashboard-provided URLs**

Set both database URLs as Codespaces secrets, restart the Codespace to load them, then run:

```sh
npm ci --include=dev
npm run db:migrate
npm test
npm run build
node --import tsx scripts/verify-neon.ts
```

The initial migration targets an empty schema. For a database already populated by a PDF-era `prisma db push`, clone the database to a branch, compare its schema and data with `packages/db/prisma/schema.prisma`, and prepare a branch-specific upgrade before applying migrations to the live database. Preserve the existing user IDs and ledger. Existing public links from an earlier implementation require re-sharing with the new tokens.

## 3. Configure Redis, R2 and the fleet

- **Upstash Redis.** Use a TLS Redis connection string (`rediss://…`) and disable key eviction. Web fleet administration and the worker must point at the same instance.
- **Cloudflare R2.** Create a private bucket such as `stakeout-artifacts`. Give the worker bucket-scoped read/write credentials and the web app bucket-scoped read credentials for signing playback URLs. Keep the same bucket name on both. For browser playback configure CORS for your deployed web origin, GET and HEAD, and the Range request header. Device uploads use signed PUT requests directly. Configure lifecycle policies separately for raw bundles and video if you want a retention window.
- **DuoPlus.** Use dedicated, powered-on Android images with the required Google apps, shell access, `screenrecord`, a UI dump utility, `tar` and `curl`. The bootstrap runner clears the selected app's data before **each** measurement. Reserve separate images for any workflow that relies on a signed-in or warmed profile.
- **Proxy-Seller.** Assign a different saved DuoPlus proxy record to each phone. Copy residential credentials. Set `PROXY_ISP_IDS_JSON` to the mapping between a wizard ISP code (e.g. `Charter Communications`) and your provider's numeric ISP ID. Set `PROXY_STATE_IDS_JSON` to the state abbreviation → provider subdivision ID mapping for the fourth fallback. With an unmapped ISP the worker requests geography alone and records that difference in the receipt. Standard login targeting uses port 10000. Set `PROXY_USE_SLOT_PORT=true` on both hosts only if your provider issued the slot ports. The first auto-assigned database slot is 1.

## 4. Deploy the web and worker services

| Service | Root and settings | Environment values |
| --- | --- | --- |
| Vercel web | Import the private repo. Select Next.js and root `apps/nextjs`. Include files outside the root directory for monorepo builds. The checked-in `vercel.json` installs from the repository root, generates Prisma and builds the web workspace. | Both database URLs, `AUTH_SECRET`, Redis, DuoPlus API key, R2 read credentials and bucket, PayPal settings, teaser limit, optional map style, matching proxy port settings |
| Railway worker | Deploy from the same repo, service root `/`. The root `railway.json` selects `apps/worker/Dockerfile`. Run it as an always-on service. | Both database URLs, Redis, DuoPlus key, Proxy-Seller settings, R2 write credentials and bucket, `MOBILE_CONCURRENCY` |
| Codespaces | Optional verification or worker host. Configure secrets before launching. | Variables for the process being tested |

Generate `AUTH_SECRET` as a random value of at least 32 characters. Set the same secret on all web replicas for an environment. Use separate values for staging and production. Configure pricing and `NEXT_PUBLIC_*` variables before building the web app.

Run the migration as a release step before deploying either service. Preview builds should point to their own branch. After deployment, open `/api/health/neon` and expect `{"ok":true,"service":"postgres"}`. Look for the two queue names in Railway's start log.

## 5. Establish the first administrator

Register the intended operator account through `/login?mode=register`. All self-registrations receive the AGENCY role and a single 150-credit grant. Confirm its identity, then run this in Neon's SQL editor on the intended branch, substituting the account's exact ID and email:

```sql
UPDATE "User"
SET role = 'ADMIN'
WHERE id = 'verified-user-id'
  AND email = 'verified-operator@example.com'
RETURNING id, email, role;
```

Open `/admin/devices`. Enter each `imageId, proxyId` pair individually or by bulk paste. Click **Bootstrap All**. The web app installs the runner and reads Android's model and brand. Choose the corresponding phone model in the scan wizard. Public registration cannot claim a legacy passwordless account.

## 6. Connect credit sales

Create a PayPal sandbox REST app. Set `PAYPAL_CLIENT_ID`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MERCHANT_ID` and the sandbox API base. Set the desired USD price **in integer cents** for each pack of 500, 750, 3,000 or 7,500 credits. The PDF gives the quantities and leaves their selling prices open.

Create a webhook for `https://YOUR-WEB-DOMAIN/api/webhooks/paypal`, subscribe to `PAYMENT.CAPTURE.COMPLETED`, and save `PAYPAL_WEBHOOK_ID`. Redeploy. Buy a sandbox pack from **Top Up**. Check that the order and capture resolve to the intended merchant, user, USD price and pack. Redeliver the webhook. The `PAYPAL_TOPUP` ledger should still contain one grant for the capture.

Checkout uses one-time Orders v2 captures. The PDF lists subscription and legacy sale events alongside them. These event types have no corresponding product definition in the PDF and do not grant credits in this build. Switch the base URL, both client IDs, merchant, secret and webhook ID together when moving to live sales.

## 7. Smoke test and operate

1. Run one Lakeland 3×3 Google Maps scan with Ask Maps on. Verify an 18-credit debit, 9 distinct coordinates and a matching phone lease. Open one pin and compare the parsed order with its recording and XML.
2. On a completed run, open the leaderboard, project a competitor's ranks onto the map, verify a purple AI ring against the captured panel, then export CSV. A text mention and an explicit source pill both count toward the PDF-defined AI appearance metric. The pin detail preserves the text and extracted source labels separately.
3. Repeat the same settings. Open the before/after view and check both cameras, the three pin modes and both recordings. Open a shared link while signed out, then revoke it from the owner report.
4. On the public homepage submit a separate teaser. It creates nine real jobs and takes no user credits. The generated report updates as the worker completes pins. The lead email is stored with the scan. An operator can retrieve these leads by filtering `GridScan.leadEmail IS NOT NULL`.
5. A recurring schedule runs daily at 13:00 UTC or Mondays at 13:00 UTC. The new run is charged only when the balance covers the whole grid. Insufficient funds pause the template. After a top-up use **Resume** in scan history.
6. Monitor the queue age, failed-pin rate, count of ready phones per hardware model, R2 usage and credit ledger. The PDF's throughput and retention figures are planning estimates. Measure your fleet's actual pins/hour before setting concurrency. A 35-minute cooldown follows a detected challenge. A terminal failure returns the per-pin charge once. A free pin has zero refundable credits.

| Symptom | First check |
| --- | --- |
| Scan stays queued | Railway worker heartbeat/logs, database branch, shared Redis URL, Redis eviction settings |
| No compatible phone | Phone power and bootstrap status, displayed hardware model, enabled flag, cooldown and active lease |
| Proxy ladder exhausts | Provider-issued numeric targeting IDs, valid host/port and credential, proxy-check API result |
| R2 upload times out | Phone's outbound network, shell tools, bucket permissions and upload URL expiry |
| Unknown result layout | Inspect an actual Android UI dump and update `xmlParser.ts` against the current card structure. An unreadable layout fails the pin instead of silently reporting rank 21. |
| Credits or metrics differ | Compare `CreditLedger`, the scan's charged/refunded counts and its completed pins. SoLV uses completed pins. |

## Optional desktop AI Mode

The default image runs Android jobs. For desktop captures, build the worker Dockerfile with `--build-arg ENABLE_DESKTOP=true`. Enable `DESKTOP_ENABLED=true` on web and worker and `NEXT_PUBLIC_DESKTOP_ENABLED=true` before the web build. Supply a dedicated `DESKTOP_PROXY_URL` to the worker. The image installs the Python browser adapter and Playwright video tools. Allow its Chromium download on first launch and verify the visible answer container with `DESKTOP_ANSWER_SELECTOR` when Google's layout changes.

Desktop uses `udm=50`, geolocation permission and a separate browser context, records WebM and captures the scoped answer HTML and screenshot. It costs two credits per pin. The desktop proxy and browser are configured separately from Android hardware and the mobile proxy ladder. Verify desktop behavior with a test grid in your own environment.
