const express = require('express');
const { db, TODAY } = require('../db');
const { runwayDays } = require('../engine/core');
const { ESSENTIAL_DAILY_COST, billOut, allBills, reserveState } = require('../util');

const router = express.Router();

router.get('/dashboard', (req, res) => {
  const reserve = reserveState();
  const today = db.prepare('SELECT * FROM entries WHERE date=?').get(TODAY);
  const recent = db.prepare('SELECT net FROM entries ORDER BY date DESC LIMIT 14').all().map((r) => r.net);
  const n = recent.length;
  const min = n ? Math.min(...recent) : 0, max = n ? Math.max(...recent) : 0;
  const mean = n ? recent.reduce((a, b) => a + b, 0) / n : 0;
  const avg = Math.round(mean);
  // Variability level = coefficient of variation (stdev / mean): <0.15 low, <0.30 medium, else high.
  const sd = n ? Math.sqrt(recent.reduce((a, b) => a + (b - mean) ** 2, 0) / n) : 0;
  const cv = mean > 0 ? sd / mean : 0;
  const level = cv < 0.15 ? 'low' : cv < 0.3 ? 'medium' : 'high';
  res.json({
    safeToSpend: today ? today.spend_amt : 0, // today's spend share (net - bills - reserve)
    todayAdded: today ? today.reserve_amt : 0, // rupees added to the reserve today
    today: {
      bills: today?.bills_amt ?? 0,
      reserve: today?.reserve_amt ?? 0,
      workCosts: today ? today.fuel + today.other_costs : 0,
    },
    reservePct: Math.round((reserve.balance / reserve.target) * 100),
    runwayDays: runwayDays(reserve.balance, ESSENTIAL_DAILY_COST),
    reserve,
    variability: { min, max, avg, level },
    bills: allBills().filter((b) => !b.paid).map(billOut),
  });
});

module.exports = router;
