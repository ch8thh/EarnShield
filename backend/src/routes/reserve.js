const express = require('express');
const { db } = require('../db');
const { reserveState } = require('../util');

const router = express.Router();

router.get('/reserve', (req, res) => {
  const history = db.prepare('SELECT id,date,type,amount,reason FROM buffer_events ORDER BY date DESC, id DESC').all();
  res.json({ ...reserveState(), history });
});

module.exports = router;
