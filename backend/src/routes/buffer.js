const express = require('express');
const { db, TODAY, resetHooks, currentKey } = require('../db');
const { billCoverage, runwayDays } = require('../engine/core');
const { ESSENTIAL_DAILY_COST, allBills, protectedPool, reserveState, bad } = require('../util');

const router = express.Router();

// The simulated withdrawal waiting for /buffer/rebuild/accept: one slot per judge.
const pendingByJudge = new Map();
resetHooks.push(() => { pendingByJudge.delete(currentKey()); });

const coverageList = (pool) =>
  billCoverage(allBills().filter((b) => !b.paid), pool).map(({ bill, coveredPct }) => ({ name: bill.name, coveredPct }));

// Rupees by which the reserve sits below its safety buffer. Bills lean on that money once it is touched.
const dip = (balance, buffer) => Math.max(0, buffer - balance);

router.post('/buffer/withdraw', (req, res) => {
  const { amount, reason } = req.body || {};
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) throw bad('amount must be a positive number');
  const rs = reserveState();
  if (amount > rs.balance) throw bad('amount is more than the reserve balance');

  const after = rs.balance - amount;
  const poolBefore = protectedPool();
  // Dropping below the buffer takes money away from bills; staying above it does not.
  const poolAfter = Math.max(0, poolBefore - (dip(after, rs.buffer) - dip(rs.balance, rs.buffer)));

  // Rebuild at the driver's usual daily reserve saving (average of the last 14 days).
  const rows = db.prepare('SELECT reserve_amt FROM entries ORDER BY date DESC LIMIT 14').all();
  const avgSave = rows.length ? rows.reduce((a, r) => a + r.reserve_amt, 0) / rows.length : 0;
  const days = avgSave > 0 ? Math.ceil(amount / avgSave) : 10;
  const rebuildPlan = { days, perDay: Math.round(amount / days) };

  pendingByJudge.set(currentKey(), { amount, reason: typeof reason === 'string' && reason.trim() ? reason.trim() : 'Withdrawal', rebuildPlan });
  res.json({
    runwayBefore: runwayDays(rs.balance, ESSENTIAL_DAILY_COST),
    runwayAfter: runwayDays(after, ESSENTIAL_DAILY_COST),
    coverageBefore: coverageList(poolBefore),
    coverageAfter: coverageList(poolAfter),
    rebuildPlan,
  });
});

router.post('/buffer/rebuild/accept', (req, res) => {
  const pending = pendingByJudge.get(currentKey());
  if (!pending) throw bad('no withdrawal to accept; call /buffer/withdraw first');
  const { amount, reason, rebuildPlan } = pending;
  db.transaction(() => {
    if (amount > reserveState().balance) throw bad('reserve changed; withdraw again');
    db.prepare('UPDATE reserve_state SET balance=balance-? WHERE id=1').run(amount);
    const ev = db.prepare('INSERT INTO buffer_events (date,type,amount,reason) VALUES (?,?,?,?)');
    ev.run(TODAY, 'withdraw', amount, reason);
    ev.run(TODAY, 'rebuild', rebuildPlan.perDay, `Rebuild ${rebuildPlan.perDay}/day for ${rebuildPlan.days} days`);
  })();
  pendingByJudge.delete(currentKey());
  res.json({ ok: true });
});

module.exports = router;
