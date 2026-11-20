# EarnShield — Context

EarnShield is a mobile-first app for Bengaluru auto/cab drivers with irregular income. The driver logs each day's earnings and work costs; the app splits the **net** into three parts:

1. **Bills** — money protected for upcoming bills (rent, EMI, school fees, recharge).
2. **Reserve** — savings that build a runway for slow days.
3. **Safe to spend** — what the driver can spend today without hurting 1 and 2.

Every number comes with a plain-language explanation ("why this split?").

## Demo driver
One demo driver, **Ravi Kumar**, no login. "Today" in the seed is **20 Nov 2026**. Money is in rupees as plain numbers.

Seed data (`src/db.js`, also restored by `POST /api/seed/reset`):
- Today: gross 1850, fuel 420, other 130 → net 1300 → bills 520, reserve 260, spend 520.
- 14 earlier days with nets 900–2000, average ≈ 1150.
- Reserve balance 8400, target 15000, buffer 3000.
- Bills: Mobile recharge 299 (24 Nov, 100% covered), Room rent 6500 (1 Dec, 80%), Auto loan EMI 4200 (5 Dec, 55%), School fees 1800 (10 Dec, 30%).
- Safe-to-spend 520 (today's spend share); runway 14 days (reserve ÷ ≈600 essential daily cost).

## Stack
Node + Express + SQLite (`better-sqlite3`), in `/backend`, port 4000, CORS on, all routes under `/api`.

## Ownership
| Owner | Files |
|---|---|
| C | `routes/dashboard.js`, `entries.js`, `explain.js`, `settings.js`, `seed.js` |
| Y | `routes/bills.js`, `reserve.js`, `buffer.js`, `reports.js` |
| Shared | `src/engine/core.js` (computeDay, billCoverage, runwayDays), `src/db.js`, `src/util.js` |

## Engine contract (`src/engine/core.js`) — currently STUBS
- `computeDay({gross, fuel, otherCosts, recentNets, bills, today}) -> {net, split:{bills,reserve,spend}, reservePct, explanation[]}`
- `billCoverage(bills, protectedPool) -> [{bill, coveredPct, status}]`
- `runwayDays(reserve, essentialDailyCost) -> number`

Keep signatures stable; replace bodies.

## Data model
`entries`, `bills`, `reserve_state` (single row), `buffer_events`, `settings` (single row). See `src/db.js`. `bills.covered_amt` is rupees set aside; the API exposes `coveredPct`.

## Engine rules (implemented)
- `computeDay`: net = gross − fuel − other. Ratio = net ÷ average of previous 14 nets. Normal (0.8–1.3, or no history): bills/reserve/spend 40/20/40. Low (<0.8): 50/20/30. High (>1.3): 35/30/35. Bills and reserve are rounded to whole rupees; spend is the remainder. Net ≤ 0 sets nothing aside.
- `POST /entries` applies the split in one transaction: adds reserve to `reserve_state`, logs a `buffer_events` deposit, and fills unpaid bills (must-pay first, then earliest due date). Re-posting a date reverses the old effect first.
- `safeToSpend` (dashboard) = today's `spend_amt` (what is left after bills and reserve), 0 if nothing logged today. No spending is tracked, so there is no carry-over.
- `variability.level` uses the coefficient of variation (stdev ÷ mean) of the last 14 nets: <0.15 low, <0.30 medium, else high. `todayAdded` = today's reserve amount.

## Current state
Skeleton only. Routes return contract-shaped data from the DB, but dashboard `safeToSpend`, `POST /entries` splits, `/buffer/withdraw` and bill status are stubbed (marked `TODO`).
