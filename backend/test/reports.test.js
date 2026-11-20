process.env.DB_PATH = ':memory:';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/server');

let server, base;
before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}/api`; r(); }); }));
after(() => server.close());
const get = async (p) => { const res = await fetch(base + p); return { res, text: await res.text() }; };

test('GET /reports/summary matches contract on seed', async () => {
  const { text } = await get('/reports/summary');
  const s = JSON.parse(text);
  assert.deepEqual(Object.keys(s).sort(), ['avgPerDay', 'best', 'daysWorked', 'gross', 'lowest', 'net', 'weekly', 'workCosts']);
  assert.equal(s.daysWorked, 15);
  assert.equal(s.net, s.gross - s.workCosts);
  assert.ok(s.best.net >= s.lowest.net);
  assert.equal(s.weekly.reduce((a, w) => a + w.net, 0), s.net);
  assert.equal(s.weekly.reduce((a, w) => a + w.days, 0), s.daysWorked);
  assert.deepEqual(Object.keys(s.weekly[0]).sort(), ['days', 'net', 'weekStart']);
});

test('GET /reports/summary respects from/to', async () => {
  const { text } = await get('/reports/summary?from=2026-11-20&to=2026-11-20');
  const s = JSON.parse(text);
  assert.equal(s.daysWorked, 1);
  assert.equal(s.net, 1300);
  assert.equal(s.gross, 1850);
  assert.equal(s.workCosts, 550);
  assert.deepEqual(s.best, { date: '2026-11-20', net: 1300 });
});

test('GET /reports/export.csv header and rows', async () => {
  const { res, text } = await get('/reports/export.csv');
  assert.match(res.headers.get('content-type'), /text\/csv/);
  const lines = text.trim().split('\n');
  assert.equal(lines[0], 'date,gross,fuel,other_costs,net,bills,reserve,spend');
  assert.equal(lines.length, 16);
  assert.ok(lines.every((l) => l.split(',').length === 8));
});

test('GET /reserve matches contract', async () => {
  const { text } = await get('/reserve');
  const r = JSON.parse(text);
  assert.equal(r.balance, 8400);
  assert.equal(r.target, 15000);
  assert.equal(r.buffer, 3000);
  assert.ok(Array.isArray(r.history));
  for (const h of r.history) assert.deepEqual(Object.keys(h).sort(), ['amount', 'date', 'id', 'reason', 'type']);
});
