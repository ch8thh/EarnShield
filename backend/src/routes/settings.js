const express = require('express');
const { db } = require('../db');
const { bad } = require('../util');

const router = express.Router();
const out = (s) => ({ language: s.language, reserveMode: s.reserve_mode, weatherAlerts: !!s.weather_alerts });
const get = () => db.prepare('SELECT * FROM settings WHERE id=1').get();

router.get('/settings', (req, res) => res.json(out(get())));

router.put('/settings', (req, res) => {
  const cur = out(get());
  const b = { ...cur, ...(req.body || {}) };
  if (typeof b.language !== 'string' || typeof b.reserveMode !== 'string') throw bad('invalid settings');
  db.prepare('UPDATE settings SET language=?, reserve_mode=?, weather_alerts=? WHERE id=1')
    .run(b.language, b.reserveMode, b.weatherAlerts ? 1 : 0);
  res.json(out(get()));
});

module.exports = router;
