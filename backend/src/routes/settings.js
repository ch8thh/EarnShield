const express = require('express');
const { db } = require('../db');
const { bad } = require('../util');

const LANGUAGES = ['en', 'kn', 'hi'];
const RESERVE_MODES = ['auto', 'manual'];

const router = express.Router();
const out = (s) => ({ language: s.language, reserveMode: s.reserve_mode, weatherAlerts: !!s.weather_alerts });
const get = () => db.prepare('SELECT * FROM settings WHERE id=1').get();

router.get('/settings', (req, res) => res.json(out(get())));

router.put('/settings', (req, res) => {
  const cur = out(get());
  const body = req.body || {};
  const b = { ...cur, ...body };
  if (!LANGUAGES.includes(b.language)) throw bad(`language must be one of: ${LANGUAGES.join(', ')}`);
  if (!RESERVE_MODES.includes(b.reserveMode)) throw bad(`reserveMode must be one of: ${RESERVE_MODES.join(', ')}`);
  if (typeof b.weatherAlerts !== 'boolean') throw bad('weatherAlerts must be true or false');
  db.prepare('UPDATE settings SET language=?, reserve_mode=?, weather_alerts=? WHERE id=1')
    .run(b.language, b.reserveMode, b.weatherAlerts ? 1 : 0);
  res.json(out(get()));
});

module.exports = router;
