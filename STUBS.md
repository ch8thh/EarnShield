# STUBS — hardcoded / sample values still in the backend

To-do list. Delete a row when it's done. Paths are relative to `backend/`.

| # | File | Function / route | Currently returns | Should do instead |
|---|---|---|---|---|
| 14 | `src/routes/reserve.js` | `GET /reserve` | Raw `reserve_state` row + `buffer_events` | Fine as a read; revisit once entries/withdrawals (#8, #13) update `reserve_state` |
| 15 | `src/db.js` | seed | Reserve balance, bills' `covered_amt`, and 3 `buffer_events` are fixed demo values | Intentional demo data; keep, but real flows must not depend on it |

Not stubs (real logic): `GET /entries`, `GET /reports/summary`, `GET /reports/export.csv`, bill CRUD, settings read/write, `POST /seed/reset`.
