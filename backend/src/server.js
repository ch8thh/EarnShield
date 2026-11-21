const express = require('express');
const cors = require('cors');
const path = require('path');
const { runWithJudge } = require('./db'); // initialises schema + seed

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend')));

// Each request runs against the database of the judge named in the X-Judge-Id header.
app.use('/api', (req, res, next) => runWithJudge(req.get('x-judge-id'), next));

app.get('/api/health', (req, res) => res.json({ ok: true }));

for (const name of ['dashboard', 'entries', 'explain', 'settings', 'seed', 'bills', 'reserve', 'buffer', 'reports']) {
  app.use('/api', require(`./routes/${name}`));
}

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the frontend (frontend/index.html) so one server runs everything.
app.use(express.static(path.join(__dirname, '../../frontend')));

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (!err.status || err.status >= 500) console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`EarnShield API listening on http://localhost:${PORT}/api`));
}

module.exports = app;