const express = require('express');
const { resetSeed, clearData } = require('../db');

const router = express.Router();

router.post('/seed/reset', (req, res) => {
  resetSeed();
  res.json({ ok: true });
});

// Wipe the calling judge's data to zero (no entries, no bills, empty reserve).
router.post('/seed/clear', (req, res) => {
  clearData();
  res.json({ ok: true });
});

module.exports = router;
