process.env.DB_PATH = ':memory:';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/server');

let server, base;
before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}/api`; r(); }); }));
after(() => server.close());

const call = async (method, path, body) => {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
};

test('dashboard matches seed', async () => {
  const { status, body } = await call('GET', '/dashboard');
  assert.equal(status, 200);
  assert.equal(body.safeToSpend, 1240);
  assert.equal(body.runwayDays, 14);
  assert.deepEqual(body.reserve, { balance: 8400, target: 15000, buffer: 3000 });
  assert.equal(body.bills.length, 4);
  assert.deepEqual(body.bills.map((b) => b.coveredPct), [100, 80, 55, 30]);
});

test('entries', async () => {
  const list = await call('GET', '/entries');
  assert.equal(list.body.length, 15);
  const avg = list.body.slice(0, 14).reduce((a, e) => a + e.net, 0) / 14;
  assert.ok(Math.abs(avg - 1150) < 5);
  const post = await call('POST', '/entries', { date: '2026-11-21', gross: 1000, fuel: 200, otherCosts: 50 });
  assert.equal(post.status, 201);
  assert.ok(post.body.split && Array.isArray(post.body.explanation));
  assert.equal((await call('POST', '/entries', { date: 'x' })).status, 400);
});

test('other routes respond', async () => {
  for (const [m, p, b] of [
    ['GET', '/explain/2026-11-20'], ['GET', '/bills'], ['GET', '/reserve'],
    ['POST', '/buffer/withdraw', { amount: 1000, reason: 'repair' }], ['POST', '/buffer/rebuild/accept'],
    ['GET', '/reports/summary'], ['GET', '/reports/export.csv'], ['GET', '/settings'],
    ['PUT', '/settings', { language: 'kn' }], ['POST', '/bills', { name: 'Test', amount: 100, dueDate: '2026-12-20', repeat: 'none', mustPay: true }],
    ['PATCH', '/bills/1', { amount: 300 }], ['POST', '/bills/1/pay'],
  ]) {
    const r = await call(m, p, b);
    assert.ok(r.status < 300, `${m} ${p} -> ${r.status}`);
  }
});

test('seed reset restores state', async () => {
  await call('POST', '/bills/2/pay');
  await call('POST', '/seed/reset');
  const d = await call('GET', '/dashboard');
  assert.equal(d.body.bills.length, 4);
  assert.equal((await call('GET', '/entries')).body.length, 15);
});
