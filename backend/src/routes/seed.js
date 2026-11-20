const express = require('express');
const { resetSeed } = require('../db');

const router = express.Router();

router.post('/seed/reset', (req, res) => {
  resetSeed();
  res.json({ ok: true });
});

module.exports = router;
