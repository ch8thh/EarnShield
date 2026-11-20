process.env.DB_PATH = ':memory:';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const app = require('../src/server');

let server, base;
before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}/api`; r(); }); }));
after(() => server.close());
beforeEach(() => call('POST', '/seed/reset'));

const call = async (method, path, body) => {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};

test('bills list and coverage agree with the seed', async () => {
  const list = (await call('GET', '/bills')).body;
  assert.deepEqual(list.map((b) => b.coveredPct), [100, 80, 55, 30]);
  assert.deepEqual(list.map((b) => b.status), ['covered', 'on-track', 'on-track', 'at-risk']);
  const cov = (await call('GET', '/bills/coverage')).body;
  assert.deepEqual(cov.map((c) => c.coveredPct), [100, 80, 55, 30]);
  assert.equal(cov[0].bill.due_date, '2026-11-24'); // raw DB row, as in API.md
});

test('paying a repeating bill rolls it forward and takes the shortfall from the reserve', async () => {
  const r = await call('POST', '/bills/2/pay'); // Room rent, 6500, 5200 set aside, monthly
  assert.equal(r.body.paid, true);
  assert.equal(r.body.coveredPct, 100);
  assert.equal(r.body.status, 'paid');
  const reserve = (await call('GET', '/reserve')).body;
  assert.equal(reserve.balance, 8400 - 1300);
  assert.equal(reserve.history[0].type, 'withdraw');
  assert.equal(reserve.history[0].amount, 1300);
  const rent = (await call('GET', '/bills')).body.find((b) => b.id === 2);
  assert.equal(rent.dueDate, '2027-01-01');
  assert.equal(rent.paid, false);
  assert.equal(rent.coveredPct, 0);
});

test('paying a one-off bill marks it paid and paying twice does not charge twice', async () => {
  await call('POST', '/bills/4/pay'); // School fees, none
  const bal = (await call('GET', '/reserve')).body.balance;
  assert.equal(bal, 8400 - 1260);
  const again = await call('POST', '/bills/4/pay');
  assert.equal(again.body.paid, true);
  assert.equal((await call('GET', '/reserve')).body.balance, bal);
  assert.equal((await call('POST', '/bills/999/pay')).status, 404);
});

test('withdraw is a simulation until accepted', async () => {
  const r = await call('POST', '/buffer/withdraw', { amount: 1000, reason: 'repair' });
  assert.equal(r.status, 200);
  assert.equal(r.body.runwayBefore, 14);
  assert.equal(r.body.runwayAfter, 12);
  assert.deepEqual(r.body.coverageBefore.map((c) => c.coveredPct), [100, 80, 55, 30]);
  assert.deepEqual(r.body.coverageAfter.map((c) => c.coveredPct), [100, 80, 55, 30]); // still above the 3000 buffer
  assert.ok(r.body.rebuildPlan.days > 0 && r.body.rebuildPlan.perDay > 0);
  assert.equal((await call('GET', '/reserve')).body.balance, 8400);
});

test('withdraw below the buffer lowers bill coverage; bad amounts are rejected', async () => {
  const r = await call('POST', '/buffer/withdraw', { amount: 7000 });
  assert.equal(r.body.runwayAfter, 2);
  const before = r.body.coverageBefore.map((c) => c.coveredPct);
  const after = r.body.coverageAfter.map((c) => c.coveredPct);
  assert.ok(after[3] < before[3]);
  assert.equal((await call('POST', '/buffer/withdraw', { amount: 0 })).status, 400);
  assert.equal((await call('POST', '/buffer/withdraw', { amount: 9000 })).status, 400);
});

test('accept persists the withdrawal and rebuild plan once', async () => {
  assert.equal((await call('POST', '/buffer/rebuild/accept')).status, 400); // nothing pending yet
  const w = await call('POST', '/buffer/withdraw', { amount: 1000, reason: 'repair' });
  assert.deepEqual((await call('POST', '/buffer/rebuild/accept')).body, { ok: true });
  const reserve = (await call('GET', '/reserve')).body;
  assert.equal(reserve.balance, 7400);
  const types = reserve.history.slice(0, 2).map((h) => h.type).sort();
  assert.deepEqual(types, ['rebuild', 'withdraw']);
  assert.ok(reserve.history.some((h) => h.reason === 'repair' && h.amount === 1000));
  assert.equal(w.body.rebuildPlan.perDay > 0, true);
  assert.equal((await call('POST', '/buffer/rebuild/accept')).status, 400); // already used
});
