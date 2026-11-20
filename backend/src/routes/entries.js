const express = require('express');
const { db, TODAY } = require('../db');
const { computeDay } = require('../engine/core');
const { allBills, entryOut, bad, isDate } = require('../util');

const router = express.Router();

router.post('/entries', (req, res) => {
  const { date, gross, fuel = 0, otherCosts = 0 } = req.body || {};
  if (!isDate(date)) throw bad('date must be YYYY-MM-DD');
  if (![gross, fuel, otherCosts].every((n) => typeof n === 'number' && n >= 0)) {
    throw bad('gross, fuel, otherCosts must be non-negative numbers');
  }
  const recentNets = db.prepare('SELECT net FROM entries WHERE date<? ORDER BY date DESC LIMIT 14').all(date).map((r) => r.net);
  const r = computeDay({ gross, fuel, otherCosts, recentNets, bills: allBills(), today: date || TODAY });
  db.prepare(`INSERT OR REPLACE INTO entries (date,gross,fuel,other_costs,net,bills_amt,reserve_amt,spend_amt)
              VALUES (?,?,?,?,?,?,?,?)`)
    .run(date, gross, fuel, otherCosts, r.net, r.split.bills, r.split.reserve, r.split.spend);
  res.status(201).json({ net: r.net, split: r.split, reservePct: r.reservePct, explanation: r.explanation });
});

router.get('/entries', (req, res) => {
  const { from = '0000-01-01', to = '9999-12-31' } = req.query;
  const rows = db.prepare('SELECT * FROM entries WHERE date BETWEEN ? AND ? ORDER BY date').all(from, to);
  res.json(rows.map(entryOut));
});

module.exports = router;
