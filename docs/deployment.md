# Deployment phases with no paid infrastructure

The default target is **one Render Free web service**, serving the Vite build and
Express API together. `render.yaml` declares `plan: free`, no database, no disk,
no worker and no second hosted staging service. No deployment API key is needed
in GitHub Actions. This configuration does not create a hosting account or service.

## Phase 1: validate the change

Work on a feature branch and open a PR. The CI `validate` jobs install the lockfile,
typecheck, run the automated tests and build on Node 22 and 24. The PostgreSQL ingestion job also runs migrations and database tests. Require both matrix
jobs, the PostgreSQL job and `staging-rehearsal` to pass before merging to `main` using GitHub branch
rules, if available for the repository's plan. Workflows alone do not enforce
branch protection. Never include private founder data or deployment credentials.

## Phase 2: rehearse the production build

The dependent `staging-rehearsal` job builds the same source commit, starts the
compiled Express entry in a fresh production-mode process on an available port,
and runs `npm run test:deployment`. The checks verify:

- Health response and the production HTML, JavaScript and CSS assets.
- Illustrative market/property labels; sample properties remain unverified.
- Arbitrage and management calculations with known expected contributions.
- Invalid-input JSON errors and API 404s without SPA fallback.

This is a temporary CI rehearsal, not a public staging URL or a Render-hosted
integration test. It costs no second hosting service. It uses GitHub Actions
minutes: public standard runners are generally free; for private repositories,
check included minutes and disable paid overages in billing settings. Hosted CI
must actually pass; a local rehearsal alone does not establish that it did.

Run the same rehearsal locally after `npm ci`, `npm run db:generate` and `npm run build`:

```bash
npm run test:deployment
```

The script stops only the child process it starts. Tests use illustrative data and
never write to a database or retrieve live listings.

## Phase 3: release the public illustrative demo

1. Merge the reviewed feature PR to `main` after all checks pass. Record the full
   commit SHA and, for updates, the previously healthy deployed SHA.
2. Create or sign in to a Render account and connect this GitHub repository.
   Create a Blueprint from `render.yaml` on `main`. Inspect the proposed resources:
   exactly one **Free** web service. Validate the Blueprint in Render's UI before
   applying. Do not accept a paid instance, managed database, paid workspace or
   other paid add-on. If Free is unavailable, stop instead of upgrading.
3. Confirm the root directory is the repository root, Node is 24.22.1,
   `NODE_ENV=production`, build/start commands match `render.yaml`, health path is
   `/api/health` and automatic deployment is disabled. Render supplies `PORT`;
   do not configure Vite or a second frontend service. The first Blueprint apply
   can start an initial deployment: apply only after phase 1/2 pass.
4. For later releases, manually deploy the exact passing `main` commit in Render.
   If only "deploy latest" is available, verify that latest is the checked SHA;
   do not release an unchecked moving branch. Record the deployed commit in the
   release notes. There is no automatic deploy hook and no GitHub secret to leak.
5. Wait for Render to report a healthy deployment. Open the assigned HTTPS URL
   to allow a sleeping free service to wake, then run:

   ```bash
   npm run smoke -- https://YOUR-SERVICE.onrender.com
   ```

   Replace the placeholder with the actual origin; no path or credentials.
   Verify it matches the Render service you just deployed. Then manually check
   market cards, calculator changes and illustrative disclaimers in a browser.
   The smoke checks validate behavior, not deployment SHA: also confirm the SHA
   in Render's deploy history. Do not claim a successful release before both pass.

The initial release is a **public illustrative demo**, not a private founder
workspace. Authentication, access control and data provenance remain roadmap
work. Do not add founder information, sourced ingestion or a production database
as part of this deployment. Existing sample data and disclaimers are retained.

## Phase 4: roll back a failed release

If startup/health, smoke checks or the browser check fail, pause further releases.
Record the failure and failed SHA. Use Render's deploy history to roll back to the
previous healthy deployment if that action is offered on the Free plan. Otherwise
manually redeploy the recorded previous SHA. If unavailable, create a PR reverting
the faulty change, rerun CI and deploy the revert from `main`; avoid force pushes.
Rerun the smoke and browser checks after rollback and record the restored SHA.
For an initial release without a known good version, suspend the service and fix
through a new feature PR. No database rollback is involved in this workflow.

## Free-tier limits and activation prerequisites

Free hosting is appropriate for this illustrative demo and can sleep when idle,
produce cold starts, and stop serving when shared free quotas are exhausted. It
has no availability guarantee here. Keep files ephemeral: the app needs no saved
uploads or database. A sleeping service may need warming before smoke checks;
do not hide persistent test failures with keep-alive traffic or retry loops.

Check [Render's current Free limits](https://render.com/docs/free) and
[Blueprint specification](https://render.com/docs/blueprint-spec) at activation.
They could not be fetched from the development environment because its proxy
blocked render.com. Free quotas and plan availability are provider-controlled;
this is a free-plan configuration, not a guarantee against account-level charges.
Set account spending controls where offered and never authorize paid upgrades.
Use the supplied onrender.com domain; purchasing a domain is unnecessary.

Activation needs the user's Render account/repository connection and a successful
Blueprint review. No live deployment has been made or verified merely by committing
these files. GitHub API access is also needed to create the feature PR through
`gh`; the development proxy previously blocked api.github.com. Add render.com and
api.github.com to the cloud environment's allowed destinations if agent access to
those services is wanted, preserving existing network rules. Do not put tokens or
deploy hooks in source files or chat.

The optional Repliers/database feature is documented in [listing ingestion](listing-ingestion.md).
It is disabled by default and does not provision a database. Enabling it requires
private connection secrets, operator authentication and successful migrations.
Public display has a separate license-approval flag. Existing illustrative data
remain available without external credentials.
