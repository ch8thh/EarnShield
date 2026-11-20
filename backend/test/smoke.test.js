process.env.DB_PATH = ':memory:';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/server');
const { computeDay } = require('../src/engine/core');

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
  assert.equal(body.safeToSpend, 520); // today's spend_amt
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

test('POST /entries applies the split and is idempotent per date', async () => {
  await call('POST', '/seed/reset');
  const before = (await call('GET', '/reserve')).body;
  const body = { date: '2026-11-22', gross: 1500, fuel: 300, otherCosts: 100 };
  const a = await call('POST', '/entries', body);
  assert.equal(a.status, 201);
  assert.equal(a.body.net, 1100);
  assert.equal(a.body.split.bills + a.body.split.reserve + a.body.split.spend, 1100);
  const mid = (await call('GET', '/reserve')).body;
  assert.equal(mid.balance, before.balance + a.body.split.reserve);
  assert.equal(a.body.reservePct, Math.round((mid.balance / mid.target) * 100));
  assert.equal(mid.history.length, before.history.length + 1);
  const billsMid = (await call('GET', '/bills')).body.map((b) => b.coveredPct);

  const b = await call('POST', '/entries', body);
  assert.deepEqual(b.body.split, a.body.split);
  const after = (await call('GET', '/reserve')).body;
  assert.equal(after.balance, mid.balance);
  assert.equal(after.history.length, mid.history.length);
  assert.deepEqual((await call('GET', '/bills')).body.map((x) => x.coveredPct), billsMid);

  // a different amount on the same date replaces the old effect
  const c = await call('POST', '/entries', { ...body, gross: 1000 });
  assert.equal((await call('GET', '/reserve')).body.balance, before.balance + c.body.split.reserve);

  const ex = await call('GET', '/explain/2026-11-22');
  assert.ok(ex.body.explanation.length >= 2 && ex.body.steps.length === 7);
  await call('POST', '/seed/reset');
  assert.equal((await call('GET', '/reserve')).body.balance, 8400);
});

test('computeDay', () => {
  const recentNets = [1000, 1200, 1100, 1300]; // avg 1150
  const run = (gross, nets = recentNets) => computeDay({ gross, fuel: 0, otherCosts: 0, recentNets: nets, bills: [], today: '2026-11-20' });
  const seed = computeDay({ gross: 1850, fuel: 420, otherCosts: 130, recentNets, bills: [], today: '2026-11-20' });
  assert.equal(seed.net, 1300);
  assert.deepEqual(seed.split, { bills: 520, reserve: 260, spend: 520 });
  assert.equal(seed.reservePct, 20);
  const low = run(800);
  assert.deepEqual(low.split, { bills: 400, reserve: 160, spend: 240 });
  const high = run(2000);
  assert.deepEqual(high.split, { bills: 700, reserve: 600, spend: 700 });
  assert.deepEqual(run(1000, []).split, { bills: 400, reserve: 200, spend: 400 });
  for (const r of [low, high, seed, run(1001), run(777)]) {
    assert.equal(r.split.bills + r.split.reserve + r.split.spend, r.net);
    assert.ok(r.explanation.length >= 2 && r.explanation.length <= 4);
  }
  assert.match(seed.explanation[0], /₹1,300/);
  for (const g of [0, -1]) {
    const z = computeDay({ gross: g, fuel: 100, otherCosts: 0, recentNets, bills: [], today: '2026-11-20' });
    assert.deepEqual(z.split, { bills: 0, reserve: 0, spend: 0 });
    assert.equal(z.reservePct, 0);
    assert.match(z.explanation.join(' '), /No money is set aside/);
  }
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

test('PUT /settings validates values', async () => {
  await call('POST', '/seed/reset');
  for (const bad of [{ language: 'fr' }, { language: 5 }, { reserveMode: 'x' }, { weatherAlerts: 'yes' }]) {
    assert.equal((await call('PUT', '/settings', bad)).status, 400, JSON.stringify(bad));
  }
  assert.deepEqual((await call('GET', '/settings')).body, { language: 'en', reserveMode: 'auto', weatherAlerts: true });
  const ok = await call('PUT', '/settings', { language: 'hi', weatherAlerts: false });
  assert.deepEqual(ok.body, { language: 'hi', reserveMode: 'auto', weatherAlerts: false });
  await call('POST', '/seed/reset');
});

test('seed reset restores state', async () => {
  await call('POST', '/bills/2/pay');
  await call('POST', '/seed/reset');
  const d = await call('GET', '/dashboard');
  assert.equal(d.body.bills.length, 4);
  assert.equal((await call('GET', '/entries')).body.length, 15);
});
