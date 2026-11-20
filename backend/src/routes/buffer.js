const express = require('express');
const { bad } = require('../util');

const router = express.Router();

// TODO: real simulation via engine (runwayDays, billCoverage); persist on accept.
router.post('/buffer/withdraw', (req, res) => {
  const { amount } = req.body || {};
  if (typeof amount !== 'number' || amount <= 0) throw bad('amount must be a positive number');
  res.json({
    runwayBefore: 14,
    runwayAfter: 11,
    coverageBefore: [
      { name: 'Mobile recharge', coveredPct: 100 }, { name: 'Room rent', coveredPct: 80 },
      { name: 'Auto loan EMI', coveredPct: 55 }, { name: 'School fees', coveredPct: 30 },
    ],
    coverageAfter: [
      { name: 'Mobile recharge', coveredPct: 100 }, { name: 'Room rent', coveredPct: 70 },
      { name: 'Auto loan EMI', coveredPct: 45 }, { name: 'School fees', coveredPct: 20 },
    ],
    rebuildPlan: { days: 10, perDay: Math.round(amount / 10) },
  });
});

router.post('/buffer/rebuild/accept', (req, res) => res.json({ ok: true }));

module.exports = router;
