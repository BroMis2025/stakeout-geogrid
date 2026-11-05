# Stakeout

Stakeout measures where a business appears across a US search grid. An agency chooses a query, business, location and mobile surface. Each completed pin has a device recording, the captured accessibility XML, and a JSON receipt. The dashboard compares organic ranks with AI appearances and can show the same coordinate across two runs.

**Start with [Cloud setup](docs/CLOUD_SETUP.md).** The default installation runs in GitHub Codespaces, Vercel and Railway. The Mac mini only needs a browser.

| Directory | Contents |
| --- | --- |
| `apps/nextjs` | Agency authentication, scan wizard, reports, synchronized comparison maps, fleet admin, free teaser and PayPal checkout |
| `apps/worker` | BullMQ consumers, device leasing, proxy checks, XML parsing, private R2 evidence and optional desktop AI Mode capture |
| `packages/core` | Grid geometry, pricing and scan transactions, scheduling, R2 access and the on-device shell script |
| `packages/db` | Prisma schema, migration and shared Neon client |
| `scripts`, `tests` | Cloud database setup, service checks, regression tests and disposable database integration checks |
| `docs/PDF_COVERAGE.md` | How the 87 pages map to the implementation, including corrections and operator settings |

## First scan

1. Complete cloud setup and bootstrap one dedicated DuoPlus phone. The admin fleet table displays the model reported by Android.
2. Sign in to `/new-scan`, select that hardware profile, choose Google Maps, and center the grid on the business. A 3×3 grid costs **9 credits**, or **18 credits** with Ask Maps capture.
3. Open the new report from `/scans`. Select a completed pin to inspect its recording, result order, AI text, observed proxy exit, and raw evidence.
4. Click **Share report** to generate a client link. **Revoke link** removes access to that report and comparisons that depend on it.
5. Choose a daily or weekly schedule to produce comparable runs. **Compare vs. previous** opens both maps and recordings. The before and after runs must belong to the same agency and use matching campaign settings.

## Build in Codespaces

```sh
npm ci
npm test
npm run build
```

The build generates Prisma Client, type-checks the worker and builds the web app. Cloud connections and a running worker are needed for live scans. The release checks and remaining live acceptance steps are in [Verification](docs/VERIFICATION.md).
