const express = require('express');
const { db } = require('../db');

const router = express.Router();
const range = (q) => [q.from || '0000-01-01', q.to || '9999-12-31'];

router.get('/reports/summary', (req, res) => {
  const [from, to] = range(req.query);
  const rows = db.prepare('SELECT * FROM entries WHERE date BETWEEN ? AND ? ORDER BY date').all(from, to);
  const sum = (f) => rows.reduce((a, r) => a + f(r), 0);
  const net = sum((r) => r.net);
  const pick = (cmp) => rows.reduce((m, r) => (!m || cmp(r.net, m.net) ? r : m), null);
  const best = pick((a, b) => a > b), lowest = pick((a, b) => a < b);
  const weeks = {};
  for (const r of rows) {
    const d = new Date(r.date + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Monday
    const k = d.toISOString().slice(0, 10);
    (weeks[k] ||= { weekStart: k, net: 0, days: 0 });
    weeks[k].net += r.net; weeks[k].days += 1;
  }
  res.json({
    gross: sum((r) => r.gross), workCosts: sum((r) => r.fuel + r.other_costs), net,
    daysWorked: rows.length, avgPerDay: rows.length ? Math.round(net / rows.length) : 0,
    best: best && { date: best.date, net: best.net }, lowest: lowest && { date: lowest.date, net: lowest.net },
    weekly: Object.values(weeks),
  });
});

router.get('/reports/export.csv', (req, res) => {
  const [from, to] = range(req.query);
  const rows = db.prepare('SELECT * FROM entries WHERE date BETWEEN ? AND ? ORDER BY date').all(from, to);
  const lines = ['date,gross,fuel,other_costs,net,bills,reserve,spend',
    ...rows.map((r) => [r.date, r.gross, r.fuel, r.other_costs, r.net, r.bills_amt, r.reserve_amt, r.spend_amt].join(','))];
  res.type('text/csv').attachment('earnshield.csv').send(lines.join('\n') + '\n');
});

module.exports = router;
