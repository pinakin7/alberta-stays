# Alberta Stays

Investment research and scenario-planning platform for a three-founder Alberta short-term rental venture.

## Stack
React + TypeScript + Vite frontend, Express + TypeScript API. The server serves the built frontend in production.

## Local setup
```bash
npm ci
npm run dev
```
Visit http://localhost:5173. API at http://localhost:3001.

## Production
```bash
npm run build
npm start
```
Use Node.js 22.12+ or 24 LTS (CI tests both). Deploy to a Node host with build command `npm ci && npm run build`, start command `npm start`, and `PORT` assigned by the host.

## API
- GET /api/health
- GET /api/markets
- GET /api/properties
- POST /api/scenarios/calculate

Example: `{"model":"arbitrage","grossRevenue":40000,"expenseRatio":0.325,"monthlyRent":2000,"monthlyDebt":0,"managementFee":0.2}`

## Roadmap for Codex
1. Add Vitest/Supertest and GitHub Actions tests.
2. Add PostgreSQL and Prisma for sourced properties, markets and versioned scenarios.
3. Add ingestion adapters for authorized data sources and CSV imports with provenance, freshness and error handling.
4. Add authenticated founder accounts, RBAC and audit logs.
5. Add scenario comparisons, dashboards and portfolio risk modeling.
6. Add licensing/zoning review workflows and human verification of STR eligibility.

### Important
Data shown is illustrative, not verified current inventory. No live scraper or production database is connected. Management activities may require Alberta real estate licensing. Do not scrape Airbnb or REALTOR.ca without permission; follow source terms and applicable law. Never commit credentials, personal financial details or private founder information.

## Validation and development configuration

```bash
npm run typecheck
npm test
npm run build
```

Vitest covers pure financial calculations, Express request validation/error handling,
and React loading failures and stale-request behavior. CI runs these commands on
pushes and pull requests using the committed dependency lockfile.
Copy `.env.example` to `.env` if needed; never commit secrets. `npm start` loads
`.env` and serves the built client and API together. Development uses Vite's
same-origin `/api` proxy to port 3001; keep that default during development.
Cross-origin API access is not enabled. No database or external API credentials
are needed for the current illustrative workflow.

## Financial assumptions

Amounts are CAD; guest revenue and outputs are annual unless labeled monthly.
The pure calculation lives in `server/src/scenario.ts`:

- Owned/arbitrage operator revenue equals guest revenue. Operating costs equal
  guest revenue times the expense ratio.
- Management operator revenue equals guest revenue times the management fee.
  Its expense ratio applies to **management fee income**, not guest revenue.
  Owner-paid property expenses, rent and debt do not reduce operator contribution.
- Arbitrage subtracts annual lease rent; ownership subtracts annual cash debt
  service. Debt service is financing, not an operating expense or tax deduction.
- Break-even is fixed rent/debt divided by the guest-revenue contribution margin.
  Zero fixed costs with a positive margin gives zero; a zero margin gives `null`
  (shown as N/A). Negative cash flow remains visible.

Guest revenue, management fees, operating costs and financing are returned
separately. Outputs exclude income tax, initial setup/capital costs and central
corporate overhead; those must be budgeted separately before investing. No tax,
permit eligibility or live market claims are calculated. Existing illustrative
market and property data remain unchanged.

The API accepts only JSON with finite nonnegative amounts up to $10 million and
ratios between 0 and 1. Unknown fields are rejected. Errors use JSON responses:
400 invalid input/malformed JSON, 413 oversized body, 415 unsupported content type,
404 unknown API route and a generic 500 without internal details. The client
clears obsolete results and reports failed requests instead of retaining a stale
projection.

This prepares a development workflow, not a public production launch. Founder
authentication/access controls, migrations, secure hosting and sourced data
remain separate roadmap work. Do not connect a production database yet.

## Deployment phases (Free plan)

See [the deployment guide](docs/deployment.md) for CI validation, a production-build
staging rehearsal, manual release to one Render Free service, smoke checks and
rollback. `render.yaml` provisions no database or paid instance. Rehearse locally
with `npm run build && npm run test:deployment`; check a deployed service with
`npm run smoke -- https://YOUR-SERVICE.onrender.com`. Hosting account activation,
current free-tier limits and successful live checks are separate prerequisites.
