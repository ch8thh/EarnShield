const express = require('express');
const { db, TODAY } = require('../db');
const { billCoverage } = require('../engine/core');
const { billOut, allBills, protectedPool, bad, isDate } = require('../util');

const router = express.Router();
const one = (id) => db.prepare('SELECT * FROM bills WHERE id=?').get(id);

router.get('/bills', (req, res) => res.json(allBills().map(billOut)));

router.post('/bills', (req, res) => {
  const { name, amount, dueDate, repeat = 'none', mustPay = true } = req.body || {};
  if (!name || typeof amount !== 'number' || amount <= 0 || !isDate(dueDate)) {
    throw bad('name, amount (>0) and dueDate (YYYY-MM-DD) are required');
  }
  const r = db.prepare(`INSERT INTO bills (name,amount,due_date,"repeat",must_pay) VALUES (?,?,?,?,?)`)
    .run(name, amount, dueDate, repeat, mustPay ? 1 : 0);
  res.status(201).json(billOut(one(r.lastInsertRowid)));
});

router.patch('/bills/:id', (req, res) => {
  const cur = one(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Bill not found' });
  const b = req.body || {};
  const next = {
    name: b.name ?? cur.name, amount: b.amount ?? cur.amount, due_date: b.dueDate ?? cur.due_date,
    repeat: b.repeat ?? cur.repeat, must_pay: b.mustPay === undefined ? cur.must_pay : b.mustPay ? 1 : 0,
  };
  if (!isDate(next.due_date) || typeof next.amount !== 'number') throw bad('invalid bill fields');
  db.prepare(`UPDATE bills SET name=?, amount=?, due_date=?, "repeat"=?, must_pay=? WHERE id=?`)
    .run(next.name, next.amount, next.due_date, next.repeat, next.must_pay, cur.id);
  res.json(billOut(one(cur.id)));
});

// Next due date for a repeating bill (month-end safe: 31 Jan + 1 month = 28/29 Feb).
function nextDue(date, repeat) {
  const d = new Date(date + 'T00:00:00Z');
  if (repeat === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return d.toISOString().slice(0, 10);
}

router.post('/bills/:id/pay', (req, res) => {
  const cur = one(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Bill not found' });
  if (cur.paid) return res.json(billOut(cur)); // already paid: nothing to deduct twice

  db.transaction(() => {
    // The money set aside for this bill leaves the protected pool; any shortfall comes out of the reserve.
    const shortfall = Math.max(0, cur.amount - cur.covered_amt);
    const take = Math.min(shortfall, db.prepare('SELECT balance FROM reserve_state WHERE id=1').get().balance);
    if (take > 0) {
      db.prepare('UPDATE reserve_state SET balance=balance-? WHERE id=1').run(take);
      db.prepare(`INSERT INTO buffer_events (date,type,amount,reason) VALUES (?, 'withdraw', ?, ?)`)
        .run(TODAY, take, `Paid ${cur.name}`);
    }
    if (cur.repeat === 'weekly' || cur.repeat === 'monthly') {
      // Repeating bills start a new cycle: next due date, nothing covered yet.
      db.prepare('UPDATE bills SET due_date=?, paid=0, covered_amt=0 WHERE id=?').run(nextDue(cur.due_date, cur.repeat), cur.id);
    } else {
      db.prepare('UPDATE bills SET paid=1, covered_amt=amount WHERE id=?').run(cur.id);
    }
  })();
  // The response describes the bill that was just paid.
  res.json(billOut({ ...cur, paid: 1, covered_amt: cur.amount }));
});

// Engine output for the unpaid-bill pool (raw DB rows in `bill`, see API.md).
router.get('/bills/coverage', (req, res) => res.json(billCoverage(allBills(), protectedPool())));

module.exports = router;
