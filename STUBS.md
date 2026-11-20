# STUBS — hardcoded / sample values still in the backend

To-do list. Delete a row when it's done. Paths are relative to `backend/`.

| # | File | Function / route | Currently returns | Should do instead |
|---|---|---|---|---|
| 15 | `src/db.js` | seed | Reserve balance, bills' `covered_amt`, and 3 `buffer_events` are fixed demo values | Intentional demo data; keep, but real flows must not depend on it |
| 16 | `src/routes/settings.js` | `PUT /settings` | Values are now validated | `reserveMode` still does not influence the engine; make it change the split |

Not stubs (real logic): `GET /entries`, `GET /reports/summary`, `GET /reports/export.csv`, bill CRUD, settings read/write, `POST /seed/reset`.
