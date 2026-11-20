const express = require('express');
const { db } = require('../db');
const { computeDay } = require('../engine/core');
const { allBills, reserveState, entryOut, bad, isDate } = require('../util');

const router = express.Router();

router.post('/entries', (req, res) => {
  const { date, gross, fuel = 0, otherCosts = 0 } = req.body || {};
  if (!isDate(date)) throw bad('date must be YYYY-MM-DD');
  if (![gross, fuel, otherCosts].every((n) => typeof n === 'number' && n >= 0)) {
    throw bad('gross, fuel, otherCosts must be non-negative numbers');
  }
  const recentNets = db.prepare('SELECT net FROM entries WHERE date<? ORDER BY date DESC LIMIT 14').all(date).map((r) => r.net);
  const r = computeDay({ gross, fuel, otherCosts, recentNets, bills: allBills(), today: date });

  const apply = db.transaction(() => {
    // Priority order: must-pay first, then earliest due date.
    const unpaid = () => db.prepare('SELECT * FROM bills WHERE paid=0 ORDER BY must_pay DESC, due_date, id').all();
    const setCovered = db.prepare('UPDATE bills SET covered_amt=? WHERE id=?');

    // Re-posting a date: undo the previous entry's effects first.
    const old = db.prepare('SELECT * FROM entries WHERE date=?').get(date);
    if (old) {
      db.prepare('UPDATE reserve_state SET balance=balance-? WHERE id=1').run(old.reserve_amt);
      // Give back exactly what this entry added to each bill.
      for (const al of db.prepare('SELECT * FROM entry_bill_alloc WHERE date=?').all(date)) {
        db.prepare('UPDATE bills SET covered_amt=MAX(0, covered_amt-?) WHERE id=?').run(al.amount, al.bill_id);
      }
      db.prepare('DELETE FROM entry_bill_alloc WHERE date=?').run(date);
      db.prepare(`DELETE FROM buffer_events WHERE date=? AND type='deposit' AND reason='Daily reserve'`).run(date);
    }

    db.prepare(`INSERT OR REPLACE INTO entries (date,gross,fuel,other_costs,net,bills_amt,reserve_amt,spend_amt)
                VALUES (?,?,?,?,?,?,?,?)`)
      .run(date, gross, fuel, otherCosts, r.net, r.split.bills, r.split.reserve, r.split.spend);

    db.prepare('UPDATE reserve_state SET balance=balance+? WHERE id=1').run(r.split.reserve);
    if (r.split.reserve > 0) {
      db.prepare(`INSERT INTO buffer_events (date,type,amount,reason) VALUES (?, 'deposit', ?, 'Daily reserve')`).run(date, r.split.reserve);
    }

    let left = r.split.bills;
    for (const b of unpaid()) {
      if (left <= 0) break;
      const add = Math.min(left, Math.max(0, b.amount - b.covered_amt));
      if (add > 0) {
        setCovered.run(b.covered_amt + add, b.id);
        db.prepare('INSERT INTO entry_bill_alloc (date,bill_id,amount) VALUES (?,?,?)').run(date, b.id, add);
      }
      left -= add;
    }
    return reserveState();
  });
  const rs = apply();
  const reservePct = rs.target > 0 ? Math.round((rs.balance / rs.target) * 100) : 0;
  res.status(201).json({ net: r.net, split: r.split, reservePct, explanation: r.explanation });
});

router.get('/entries', (req, res) => {
  const { from = '0000-01-01', to = '9999-12-31' } = req.query;
  const rows = db.prepare('SELECT * FROM entries WHERE date BETWEEN ? AND ? ORDER BY date').all(from, to);
  res.json(rows.map(entryOut));
});

module.exports = router;
