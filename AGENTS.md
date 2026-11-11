# Codex instructions — Alberta Stays

## Mission
Build a maintainable, secure investment-research platform for a three-founder Alberta short-term rental business. Keep assumptions and illustrative data clearly labeled.

## Architecture
- React 18 + TypeScript + Vite in `client/`.
- Express 4 + TypeScript in `server/`.
- `npm run dev` starts both processes.
- `npm run build` compiles the Vite client and the Express server.
- `npm start` serves the production build.

## Requirements
- Do not invent live listings, performance statistics, municipal permit eligibility, or regulatory compliance.
- Store property provenance (source URL, retrieved timestamp, verification status) once ingestion exists.
- Use only authorized data APIs, uploads, or compliant crawling. Do not circumvent access restrictions or scrape Airbnb or REALTOR.ca without authorization.
- Separate guest revenue, operator management fees, operating expenses, financing, tax, setup costs, and central overhead.
- Keep scenario-calculation functions independently testable and add tests for break-even and loss-making cases.
- Validate API inputs server-side; never commit secrets or personal founder data.
- Add .env.example for configurable variables, without real credentials.
- Do not use a production database before migrations, secrets management, authentication, and access control are in place.
- Use feature branches and PRs with a concise summary, testing notes, and any assumptions.

## First tasks
1. Add a dependency lockfile and CI workflow running typecheck/build/tests.
2. Extract financial calculation into pure tested functions, correcting management-specific cost semantics.
3. Add PostgreSQL/Prisma data model and migrations for markets, listings, data sources, and scenario snapshots.
4. Add authorized CSV import with provenance and validation.
5. Add private founder authentication/roles and secure hosting configuration.
