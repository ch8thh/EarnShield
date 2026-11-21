// Per-judge isolation: each X-Judge-Id gets its own seeded database.
const os = require('os');
const path = require('path');
const fs = require('fs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'es-judges-'));
process.env.DB_PATH = path.join(dir, 'earnshield.db');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/server');

let server, base;
before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}/api`; r(); }); }));
after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

const call = async (id, method, p, body) => {
  const headers = { 'content-type': 'application/json' };
  if (id) headers['x-judge-id'] = id;
  const res = await fetch(base + p, { method, headers, body: body && JSON.stringify(body) });
  return res.json();
};
const A = 'judge-aaaaaaaa', B = 'judge-bbbbbbbb';

test('each judge starts with the seeded demo data', async () => {
  for (const id of [A, B]) {
    const d = await call(id, 'GET', '/dashboard');
    assert.equal(d.reserve.balance, 8400);
    assert.equal(d.bills.length, 4);
  }
});

test('one judge\'s changes do not leak to another', async () => {
  await call(A, 'POST', '/bills', { name: 'Judge A bill', amount: 500, dueDate: '2026-12-20' });
  await call(A, 'POST', '/entries', { date: '2026-11-20', gross: 3000, fuel: 100, otherCosts: 0 });
  const a = await call(A, 'GET', '/dashboard');
  const b = await call(B, 'GET', '/dashboard');
  assert.equal(a.bills.length, 5);
  assert.equal(b.bills.length, 4);
  assert.notEqual(a.reserve.balance, b.reserve.balance);
  assert.equal(b.reserve.balance, 8400);
});

test('pending withdrawal is per judge', async () => {
  await call(A, 'POST', '/buffer/withdraw', { amount: 500 });
  const r = await call(B, 'POST', '/buffer/rebuild/accept');
  assert.match(r.error, /no withdrawal/);
  assert.equal((await call(A, 'POST', '/buffer/rebuild/accept')).ok, true);
});

test('reset only affects the calling judge', async () => {
  await call(A, 'POST', '/seed/reset');
  assert.equal((await call(A, 'GET', '/dashboard')).bills.length, 4);
});

test('missing or invalid id falls back to the shared default DB', async () => {
  await call(null, 'POST', '/bills', { name: 'Default bill', amount: 100, dueDate: '2026-12-22' });
  assert.equal((await call('../../etc/passwd', 'GET', '/dashboard')).bills.length, 5);
  assert.equal((await call(B, 'GET', '/dashboard')).bills.length, 4);
  assert.ok(!fs.existsSync(path.join(dir, 'etc')));
});

test('judge data persists across requests (separate file on disk)', async () => {
  assert.ok(fs.existsSync(path.join(dir, 'judges', A + '.db')));
});
