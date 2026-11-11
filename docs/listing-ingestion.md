# Repliers listings and PostgreSQL storage

This feature branch adds a server-side Repliers adapter, source registration,
bounded CSV import, a PostgreSQL/Prisma data model and a read-only listing browser.
It does not scrape housing websites or replace illustrative planning benchmarks.
Imported asking prices are not revenue estimates, STR eligibility or independently
verified current inventory. All imported rows start as **unverified**.

## What is ready and what needs account access

The adapter uses [Repliers](https://docs.repliers.io/reference/why-use-this-api),
not Airbnb/REALTOR.ca scraping. It requests `/listings` with `state=AB`, a specific
city, `status=A`, `type=Sale`, `resultsPerPage=100` and a `pageNum`. The key is sent
only by the Express server in the `REPLIERS-API-KEY` header. There are no automatic
API requests during build, startup, browser visits or tests.

The request/response mapping is grounded in Repliers' published official
[`@repliers.io/api-types` 0.4.0](https://www.npmjs.com/package/@repliers.io/api-types).
The current docs and live API were blocked by this cloud environment's proxy,
and no API key or MLS entitlement was configured. Therefore no real listing was
fetched, and the adapter's current live contract remains to be confirmed using
an authorized account. Test listings are explicitly synthetic and never seeded
into the application database.

A Repliers account/key does not by itself establish Alberta MLS coverage or
permission to store, redistribute or publicly display every field. Confirm the
account's boards, retention/deletion rules, mandatory disclaimers, brokerage/MLS
attribution and approved consumer use before enabling publication. API fees are
separate from the database/hosting free tiers; use an existing authorized plan
or trial within its limits. This change does not subscribe to a paid API plan.

## Free-tier database and secrets

Use an external PostgreSQL database such as a **Neon Free** project, subject to
its current quotas. Render Free's local filesystem is ephemeral; do not use a
SQLite file there as persistent storage. Do not create a paid database or assume
a time-limited Render database trial is permanent free storage. Choose an
available free region near the web service and verify current provider terms.
No cloud database was provisioned by this change.

Configure these values privately in Render's environment settings, never source
files, client-side `VITE_*` variables or chat:

- `DATABASE_URL`: the runtime PostgreSQL connection, preferably the provider's
  pooled connection. Use TLS certificate verification (`sslmode=verify-full`).
- `DIRECT_URL`: the direct connection for migrations, also with verified TLS.
- `ADMIN_INGEST_TOKEN`: a randomly generated secret with at least 32 characters.
  Use a password manager or generate it locally, for example `openssl rand -hex 32`.
- `REPLIERS_API_KEY`: the licensed server-side API key.

Keep `ENABLE_LISTING_STORAGE=false` initially. The repository ships no credential
values. API administration uses a server-to-server bearer token, not a browser
login. Public endpoints are read-only; import, source management, sync and purge
require the token. This is a narrow operator integration, not founder accounts or
RBAC. Keep founder information and personal data out of this database. There is
no production database connection until the operator enables it.

## Migrations and activation

1. Install with `npm ci`, then `npm run db:generate` to generate the Prisma client.
2. Against a development database first, set the private connection variables and
   run `npm run db:migrate`. Run it again to confirm repeatability. Never use
   `prisma db push` or `migrate reset` on production.
3. Review the committed migration and grant the runtime role only the needed
   table privileges. Use a separate migration role/direct URL where supported.
   Take a provider backup/restore point before future schema changes.
4. On Render, deploy the reviewed branch through the existing release workflow.
   The Blueprint build generates Prisma before typechecking/building. Leave the
   storage flags disabled until database/secrets are configured. Enabling
   `ENABLE_LISTING_STORAGE=true` runs pending migrations before server start;
   migration failures prevent startup. Missing URLs or a weak/missing admin token
   also fail startup rather than exposing an unprotected ingestion API.
5. Register a source, run a one-page admin sync and inspect results in the database.
   Confirm coverage, attribution and current API fields against the licensed
   account. Only then, after satisfying its display terms, set
   `LISTING_PUBLICATION_AUTHORIZED=true` to expose `/api/listings` and the listing
   browser. Leave it false if legal/display requirements remain unresolved.

Migrations create `Market`, `DataSource`, `Listing` and `ScenarioSnapshot` tables.
Snapshots have versioned input/output JSON storage for future scenario persistence;
there is no snapshot write API yet. Listing IDs are unique per source and external
ID. Repliers uses `boardId:mlsNumber` to avoid cross-board collisions. Prices use
PostgreSQL DECIMAL rather than binary floating point.

## Register the authorized source and sync

On your trusted local machine set `APP_URL=https://alberta-stays.onrender.com` and
`ADMIN_INGEST_TOKEN` securely in your shell or ignored `.env`. The Repliers key
belongs only in the server environment and is not needed by this CLI. Use HTTPS
for remote administration; HTTP is accepted only for localhost development.
Do not enter secrets in command arguments or save them in source JSON files.

Create a local `source.json` with metadata, replacing the permission-reference
placeholder with the applicable license/agreement reference:

```json
{
  "provider": "repliers",
  "name": "Repliers licensed Alberta feed",
  "url": "https://api.repliers.io",
  "permissionReference": "YOUR_STORAGE_AND_DISPLAY_LICENSE_REFERENCE",
  "authorized": true
}
```

```bash
npm run listings:admin -- source --file source.json
npm run listings:admin -- sources
npm run listings:admin -- repliers --source SOURCE_ID --city Calgary --page 1
```

Use the actual source ID returned by registration. A sync makes **one** bounded
API request and reports `nextPage`, `updated`, `skipped` and `excluded`. Continue
with the returned page only if account quotas allow it. It is not a full-market
synchronization, and no scheduler is enabled. Requests are serialized per server
process. A 429 stops immediately; errors, malformed data or oversized responses
produce no partial page import and expose no upstream body/key. Redirects are
rejected and the upstream origin cannot be selected by an API caller.

Each accepted row must be an active sale in the requested Alberta city, have
explicit `displayPublic=Y` and `displayInternetEntireListing=Y`, and include a
brokerage name. Other rows are excluded; any matching previously stored record
encountered as restricted/inactive/out-of-scope is removed. No address, images,
agent contacts, sold prices or raw provider response are stored. The asking-price
mapping assumes Alberta sale prices are CAD; confirm this with the account.

Records retain the API source URL, retrieval timestamp, MLS number, board ID and
brokerage name. A source URL is provenance, not necessarily a public consumer
listing URL; viewing it can require API authorization. Do not append API keys to
these URLs. Public publication is disabled independently of ingestion because
board-specific display obligations cannot be inferred from those two flags.

Repliers rows expire from public results **six hours after retrieval**. A sync
removes expired rows for that source, and the admin can purge all retained data:

```bash
npm run listings:admin -- purge --source SOURCE_ID
```

This expiry is a conservative application default, not proof of compliance with
an account's retention policy. It does not detect every withdrawal/revocation
between syncs. If the license requires immediate removals, custom attribution,
shorter TTL, a deletion feed or reliable scheduled refresh, implement those before
turning on publication. Disable publication and purge data when access is revoked.
No expired row is advertised as current; a retrieval timestamp never guarantees
continued availability.

## CSV fallback for authorized uploads

Register a separate source with `provider: "csv"`, its actual HTTPS origin and
an authorization reference. Only upload data you may store/display; the operator
must confirm these rights. Import headers (any order, unique, all required) are:

```csv
externalId,title,market,sourceUrl,retrievedAt,priceCad,bedrooms
```

Do not invent rows to appear as real housing inventory. Supply source-record URLs,
ISO timestamps with timezone, positive CAD asking prices up to 10 million with at
most two decimal places, and 0–99 bedrooms or an empty bedroom value. Listing URLs
must share the registered source origin and contain no credentials. No STR
eligibility or annual revenue fields are accepted.

```bash
npm run listings:admin -- csv --source SOURCE_ID --file authorized-listings.csv
```

Batches are limited to 500 rows and 90,000 CSV characters (also subject to the
API's 100kb JSON body limit). Duplicate IDs in a batch and any invalid row reject
the whole batch. Existing records update only with a newer retrieval timestamp;
identical or older imports are skipped. CSV records are dated source snapshots,
not a live refresh feed; the UI always shows their retrieval date and unverified
status. Spreadsheet exports should be handled carefully; this app only imports
CSV and renders text, not executable markup.

## Local PostgreSQL development

For a dedicated disposable local test database (the credentials below are public
**test-only** defaults, never production values):

```bash
docker run -d --name alberta-listings-test-db \
  -e POSTGRES_USER=alberta_test -e POSTGRES_PASSWORD=local-test-only \
  -e POSTGRES_DB=alberta_test -p 127.0.0.1:55432:5432 postgres:17-alpine
```

Wait for `docker exec alberta-listings-test-db pg_isready -U alberta_test -d
alberta_test` to succeed. Set `DATABASE_URL` and `DIRECT_URL` to
`postgresql://alberta_test:local-test-only@127.0.0.1:55432/alberta_test` in an
ignored local `.env`, run `npm run db:generate` and `npm run db:migrate`, then:

```bash
TEST_DATABASE_URL=postgresql://alberta_test:local-test-only@127.0.0.1:55432/alberta_test npm run test:db
```

These tests include a synthetic Repliers page exercised through authenticated
HTTP import, database persistence, publication and subsequent permission removal.
They do not contact Repliers. Stop this container with
`docker stop alberta-listings-test-db` when done; restart with `docker start`
if it already exists rather than creating another container on the same port.
Local PostgreSQL does not require an external database account.

## Validation and operational checks

`npm test` includes fixture-based Repliers request/filter/failure tests, CSV
validation, API access-control tests and the listing browser. No external API
quota is consumed. `npm run test:db` requires `TEST_DATABASE_URL` pointing to a
local database whose name ends in `_test`; it never accepts a production host.
CI creates PostgreSQL 17, applies migrations twice, and tests persistence, decimal
precision, deduplication, rollback, expiry, authentication and purge.

Run typecheck/build and `npm run test:deployment` for the existing no-database
demo workflow. For enabled storage, confirm unauthorized admin requests return
401, public listing requests return 503 until publication is approved, and a
licensed one-page sync yields source-attributed records. Test a purge and inspect
Render logs without printing credentials. Restrict administrative tokens to
trusted operators, rotate them if exposed and use provider least-privilege roles.
There is no new public endpoint accepting arbitrary URLs to crawl.

Cloud network additions needed for live verification are `docs.repliers.io`,
`api.repliers.io` and `binaries.prisma.sh`; the latter supplies Prisma CLI engines
and checksums. `api.github.com` is also needed for creating PRs through `gh`.
The environment draft service did not confirm saving the Repliers secret
requirement, so it is not configured. Enter values securely in hosting/environment
settings, not chat. No TLS or checksum verification was disabled: local Prisma
client generation and migration application used the matching official npm
WASM/JavaScript engine packages while native CLI downloads were blocked.
