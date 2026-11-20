# EarnShield API

Base URL `http://localhost:4000/api`. JSON in/out, CORS enabled, no auth. Money = rupees (numbers). Dates = `YYYY-MM-DD`. Errors: `{ "error": "message" }` with 400/404.

## Dashboard
`GET /dashboard`
```json
{ "safeToSpend": 1240, "todayAdded": 260,
  "today": { "bills": 520, "reserve": 260, "workCosts": 550 },
  "reservePct": 56, "runwayDays": 14,
  "reserve": { "balance": 8400, "target": 15000, "buffer": 3000 },
  "variability": { "min": 900, "max": 2000, "avg": 1150, "level": "high" },
  "bills": [{ "id": 1, "name": "Mobile recharge", "amount": 299, "dueDate": "2026-11-24",
              "daysLeft": 4, "coveredPct": 100, "status": "covered" }] }
```
Bill `status`: `covered | on-track | at-risk | paid`.

## Entries
- `POST /entries` `{date, gross, fuel, otherCosts}` → `201 {net, split:{bills,reserve,spend}, reservePct, explanation:[string]}` (upserts by date)
- `GET /entries?from&to` → `[{date, gross, fuel, otherCosts, net, split:{bills,reserve,spend}}]`
- `GET /explain/:date` → `{steps:[{label, amount}], explanation:[string]}` (404 if no entry)

## Bills
- `GET /bills` → bill list (fields as in dashboard, plus `repeat`, `mustPay`, `paid`)
- `POST /bills` `{name, amount, dueDate, repeat, mustPay}` → `201` bill
- `PATCH /bills/:id` any of the above fields → bill
- `POST /bills/:id/pay` → bill (`paid: true`)

## Reserve & buffer
- `GET /reserve` → `{balance, target, buffer, history:[{id,date,type,amount,reason}]}`
- `POST /buffer/withdraw` `{amount, reason}` → `{runwayBefore, runwayAfter, coverageBefore:[], coverageAfter:[], rebuildPlan}` (simulation only for now)
- `POST /buffer/rebuild/accept` → `{ok:true}`

## Reports
- `GET /reports/summary?from&to` → `{gross, workCosts, net, daysWorked, avgPerDay, best:{date,net}, lowest:{date,net}, weekly:[{weekStart,net,days}]}`
- `GET /reports/export.csv?from&to` → CSV (`date,gross,fuel,other_costs,net,bills,reserve,spend`)

## Settings & utility
- `GET /settings` / `PUT /settings` → `{language, reserveMode, weatherAlerts}` (PUT merges partial bodies)
- `POST /seed/reset` → `{ok:true}` — restore the demo seed
- `GET /health` → `{ok:true}`
