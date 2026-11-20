const { test } = require('node:test');
const assert = require('node:assert');
const { billCoverage, runwayDays } = require('../src/engine/core');

const bill = (id, name, amount, due_date, must_pay, covered_amt, paid = 0) =>
  ({ id, name, amount, due_date, repeat: 'monthly', must_pay, paid, covered_amt });
const seed = () => [
  bill(1, 'Mobile recharge', 299, '2026-11-24', 1, 299),
  bill(2, 'Room rent', 6500, '2026-12-01', 1, 5200),
  bill(3, 'Auto loan EMI', 4200, '2026-12-05', 1, 2310),
  bill(4, 'School fees', 1800, '2026-12-10', 1, 540),
];
const pcts = (r) => r.map((x) => x.coveredPct);

test('runwayDays seed and rounding', () => {
  assert.equal(runwayDays(8400, 600), 14);
  assert.equal(runwayDays(8399, 600), 13);
  assert.equal(runwayDays(100, 600), 0);
});

test('runwayDays guards', () => {
  assert.equal(runwayDays(8400, 0), 0);
  assert.equal(runwayDays(8400, -5), 0);
  assert.equal(runwayDays(0, 600), 0);
  assert.equal(runwayDays(-100, 600), 0);
  for (const bad of [NaN, Infinity, undefined, null, '600']) {
    assert.equal(runwayDays(bad, 600), 0);
    assert.equal(runwayDays(8400, bad), 0);
  }
});

test('billCoverage reproduces the seed with a big enough pool', () => {
  for (const pool of [8349, 10000]) {
    const r = billCoverage(seed(), pool);
    assert.deepEqual(pcts(r), [100, 80, 55, 30]);
    assert.deepEqual(r.map((x) => x.status), ['covered', 'on-track', 'on-track', 'at-risk']);
  }
});

test('billCoverage keeps order and the bill object unchanged', () => {
  const bills = seed().reverse();
  const r = billCoverage(bills, 8349);
  r.forEach((x, i) => assert.strictEqual(x.bill, bills[i]));
});

test('billCoverage empty and bad pool', () => {
  assert.deepEqual(billCoverage([], 1000), []);
  assert.deepEqual(billCoverage(undefined, 1000), []);
  for (const pool of [undefined, null, NaN, -50, 0]) {
    assert.deepEqual(pcts(billCoverage(seed(), pool)), [0, 0, 0, 0]);
  }
});

test('billCoverage shrinks lowest priority first when the pool is short', () => {
  // targets: 299, 5200, 2310, 540 = 8349. Pool 7000 -> cut 1349 from School fees (540), then EMI.
  const r = billCoverage(seed(), 7000);
  assert.deepEqual(pcts(r), [100, 80, Math.round((2310 - 809) / 4200 * 100), 0]);
  assert.equal(r[3].status, 'at-risk');
  // Pool 299 only covers the top-priority bill.
  assert.deepEqual(pcts(billCoverage(seed(), 299)), [100, 0, 0, 0]);
});

test('billCoverage priority: must_pay before optional, then earliest due date', () => {
  const bills = [
    bill(1, 'Optional early', 1000, '2026-11-01', 0, 1000),
    bill(2, 'Must late', 1000, '2026-12-20', 1, 1000),
    bill(3, 'Must early', 1000, '2026-11-10', 1, 1000),
  ];
  // Pool for 2 bills: optional bill is cut first, then the later must-pay bill.
  assert.deepEqual(pcts(billCoverage(bills, 2000)), [0, 100, 100]);
  assert.deepEqual(pcts(billCoverage(bills, 1500)), [0, 50, 100]);
  assert.deepEqual(pcts(billCoverage(bills, 1000)), [0, 0, 100]);
});

test('billCoverage paid bills are 100/paid and do not use the pool', () => {
  const bills = [bill(1, 'Paid', 5000, '2026-11-01', 1, 0, 1), bill(2, 'Rent', 1000, '2026-12-01', 1, 1000)];
  const r = billCoverage(bills, 1000);
  assert.deepEqual(pcts(r), [100, 100]);
  assert.deepEqual(r.map((x) => x.status), ['paid', 'covered']);
});

test('billCoverage statuses at thresholds and edge amounts', () => {
  const bills = [
    bill(1, 'a', 100, '2026-12-01', 1, 100),
    bill(2, 'b', 100, '2026-12-02', 1, 99),
    bill(3, 'c', 100, '2026-12-03', 1, 50),
    bill(4, 'd', 100, '2026-12-04', 1, 49),
    bill(5, 'zero', 0, '2026-12-05', 1, 0),
    bill(6, 'over', 100, '2026-12-06', 1, 500),
  ];
  const r = billCoverage(bills, 10000);
  assert.deepEqual(r.map((x) => x.status), ['covered', 'on-track', 'on-track', 'at-risk', 'covered', 'covered']);
  assert.equal(r[5].coveredPct, 100);
  assert.equal(r[4].coveredPct, 100);
});
