const express = require('express');
const { db } = require('../db');
const { computeDay } = require('../engine/core');
const { allBills, bad, isDate } = require('../util');

const router = express.Router();

router.get('/explain/:date', (req, res) => {
  if (!isDate(req.params.date)) throw bad('date must be YYYY-MM-DD');
  const e = db.prepare('SELECT * FROM entries WHERE date=?').get(req.params.date);
  if (!e) return res.status(404).json({ error: 'No entry for that date' });
  const recentNets = db.prepare('SELECT net FROM entries WHERE date<? ORDER BY date DESC LIMIT 14').all(e.date).map((r) => r.net);
  const { explanation } = computeDay({
    gross: e.gross, fuel: e.fuel, otherCosts: e.other_costs, recentNets, bills: allBills(), today: e.date,
    reserveMode: db.prepare('SELECT reserve_mode m FROM settings WHERE id=1').get().m,
  });
  res.json({
    steps: [
      { label: 'Gross earnings', amount: e.gross },
      { label: 'Fuel', amount: -e.fuel },
      { label: 'Other costs', amount: -e.other_costs },
      { label: 'Net', amount: e.net },
      { label: 'To bills', amount: e.bills_amt },
      { label: 'To reserve', amount: e.reserve_amt },
      { label: 'Safe to spend', amount: e.spend_amt },
    ],
    explanation,
  });
});

module.exports = router;
