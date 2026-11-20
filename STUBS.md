# STUBS — hardcoded / sample values still in the backend

To-do list. Delete a row when it's done. Paths are relative to `backend/`.

| # | File | Function / route | Currently returns | Should do instead |
|---|---|---|---|---|
| 1 | `src/engine/core.js` | `computeDay` | Fixed `net 1300`, split `520/260/520`, `reservePct 56`, canned explanation — ignores all inputs | `net = gross − fuel − otherCosts`; split net into bills/reserve/spend using `recentNets` variability and upcoming `bills`; compute `reservePct` from reserve vs target; build explanation from the actual numbers |
| 2 | `src/engine/core.js` | `billCoverage` | Hardcoded % by bill name (100/80/55/30), status from that | Allocate `protectedPool` across bills by due date and `mustPay` priority; derive `coveredPct` and `status` |
| 3 | `src/engine/core.js` | `runwayDays` | Always `14` | `floor(reserve / essentialDailyCost)`, guarding `essentialDailyCost <= 0` |
| 4 | `src/util.js` | `ESSENTIAL_DAILY_COST` | Constant `600` | Derive from settings / recurring must-pay bills / recent costs |
| 5 | `src/util.js` | `statusFor` / `billOut` | `coveredPct` from `covered_amt / amount`; status by fixed 50%/100% thresholds | Use `billCoverage` output so dashboard and `/bills` agree with the engine |
| 6 | `src/routes/dashboard.js` | `GET /dashboard` | `safeToSpend: 1240` literal | Compute from the engine (today's spend share / pool minus protected amounts) |
| 7 | `src/routes/dashboard.js` | `GET /dashboard` | `variability.level` from fixed spread thresholds (500/1000); `todayAdded` = today's reserve_amt | Define variability level properly (e.g. coefficient of variation); confirm `todayAdded` meaning |
| 8 | `src/routes/entries.js` | `POST /entries` | Stores the stub `computeDay` result (same split for any input); does not update `reserve_state`, `bills.covered_amt` or `buffer_events` | After real `computeDay`, apply split: add to reserve balance, bill coverage, and log a `buffer_events` deposit |
| 9 | `src/routes/explain.js` | `GET /explain/:date` | Steps and sentences built from stored columns with fixed wording | Use engine-generated explanation for that day (recompute with that day's `recentNets`/bills) |
| 10 | `src/routes/bills.js` | `POST /bills/:id/pay` | Sets `paid=1`, `covered_amt=amount` | Deduct from protected pool/reserve, log an event, roll `due_date` forward for repeating bills |
| 11 | `src/routes/bills.js` | `GET /bills/coverage` | Calls `billCoverage(bills, 0)`; returns raw DB rows (snake_case) in `bill` | Pass the real protected pool; return camelCase bill objects (or drop the route once #5 is done) |
| 12 | `src/routes/buffer.js` | `POST /buffer/withdraw` | Fixed `runway 14→11`, fixed coverage arrays, `rebuildPlan {days:10, perDay: amount/10}`; ignores `reason`, no DB writes | Simulate with `runwayDays` + `billCoverage` on balance − amount; compute rebuild plan from average net; don't mutate until accepted |
| 13 | `src/routes/buffer.js` | `POST /buffer/rebuild/accept` | `{ok:true}`, no effect | Persist the withdrawal (reserve balance, `buffer_events`) and the rebuild plan |
| 14 | `src/routes/reserve.js` | `GET /reserve` | Raw `reserve_state` row + `buffer_events` | Fine as a read; revisit once entries/withdrawals (#8, #13) update `reserve_state` |
| 15 | `src/db.js` | seed | Reserve balance, bills' `covered_amt`, and 3 `buffer_events` are fixed demo values | Intentional demo data; keep, but real flows must not depend on it |
| 16 | `src/routes/settings.js` | `PUT /settings` | Accepts any `language`/`reserveMode` strings | Validate against allowed values; make `reserveMode` actually influence the engine |

Not stubs (real logic): `GET /entries`, `GET /reports/summary`, `GET /reports/export.csv`, bill CRUD, settings read/write, `POST /seed/reset`.
