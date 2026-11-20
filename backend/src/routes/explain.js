const express = require('express');
const { db } = require('../db');
const { bad, isDate } = require('../util');

const router = express.Router();

router.get('/explain/:date', (req, res) => {
  if (!isDate(req.params.date)) throw bad('date must be YYYY-MM-DD');
  const e = db.prepare('SELECT * FROM entries WHERE date=?').get(req.params.date);
  if (!e) return res.status(404).json({ error: 'No entry for that date' });
  // TODO: replace with engine-generated explanation.
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
    explanation: [
      `You earned ₹${e.gross} and spent ₹${e.fuel + e.other_costs} on work costs, leaving ₹${e.net}.`,
      `₹${e.bills_amt} was set aside for bills, ₹${e.reserve_amt} for your reserve, and ₹${e.spend_amt} is yours to spend.`,
    ],
  });
});

module.exports = router;
