const express = require('express');
const { db } = require('../db');
const { billCoverage } = require('../engine/core');
const { billOut, allBills, bad, isDate } = require('../util');

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

router.post('/bills/:id/pay', (req, res) => {
  const cur = one(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Bill not found' });
  // TODO: deduct from protected pool; roll due date if repeating.
  db.prepare('UPDATE bills SET paid=1, covered_amt=amount WHERE id=?').run(cur.id);
  res.json(billOut(one(cur.id)));
});

// Exposed so Y's engine work can wire coverage in later.
router.get('/bills/coverage', (req, res) => res.json(billCoverage(allBills(), 0)));

module.exports = router;
