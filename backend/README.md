# EarnShield backend

Node + Express + SQLite (better-sqlite3). Requires Node 18+.

## Run
```bash
cd backend
npm install
npm start          # http://localhost:4000/api  (npm run dev for watch mode)
```
The database is created and seeded on first start at `backend/data/earnshield.db` (gitignored). Override with `DB_PATH`, port with `PORT`. Reset to the demo data any time:
```bash
curl -X POST localhost:4000/api/seed/reset
```

## Test
```bash
npm test           # node:test smoke tests against an in-memory DB
curl localhost:4000/api/dashboard
```

See `../API.md` for the contract and `../CONTEXT.md` for background and file ownership. `src/engine/core.js` is stubbed.
