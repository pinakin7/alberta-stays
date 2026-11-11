# Alberta Stays

Investment research and scenario-planning platform for a three-founder Alberta short-term rental venture.

## Stack
React + TypeScript + Vite frontend, Express + TypeScript API. The server serves the built frontend in production.

## Local setup
```bash
npm install
npm run dev
```
Visit http://localhost:5173. API at http://localhost:3001.

## Production
```bash
npm run build
npm start
```
Use Node.js 20+. Deploy to a Node host with build command `npm ci && npm run build` (or `npm install && npm run build` until a lockfile is generated), start command `npm start`, and `PORT` assigned by the host.

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
