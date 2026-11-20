const express = require('express');
const { db, TODAY } = require('../db');
const { runwayDays } = require('../engine/core');
const { ESSENTIAL_DAILY_COST, billOut, allBills, reserveState } = require('../util');

const router = express.Router();

router.get('/dashboard', (req, res) => {
  const reserve = reserveState();
  const today = db.prepare('SELECT * FROM entries WHERE date=?').get(TODAY);
  const recent = db.prepare('SELECT net FROM entries ORDER BY date DESC LIMIT 14').all().map((r) => r.net);
  const min = Math.min(...recent), max = Math.max(...recent);
  const avg = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  const spread = max - min;
  res.json({
    safeToSpend: 1240, // TODO: from engine
    todayAdded: today ? today.reserve_amt : 0,
    today: {
      bills: today?.bills_amt ?? 0,
      reserve: today?.reserve_amt ?? 0,
      workCosts: today ? today.fuel + today.other_costs : 0,
    },
    reservePct: Math.round((reserve.balance / reserve.target) * 100),
    runwayDays: runwayDays(reserve.balance, ESSENTIAL_DAILY_COST),
    reserve,
    variability: { min, max, avg, level: spread > 1000 ? 'high' : spread > 500 ? 'medium' : 'low' },
    bills: allBills().filter((b) => !b.paid).map(billOut),
  });
});

module.exports = router;
