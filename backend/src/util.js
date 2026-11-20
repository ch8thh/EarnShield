const { db, TODAY } = require('./db');

const ESSENTIAL_DAILY_COST = 600; // TODO: derive from settings/bills

const daysBetween = (from, to) =>
  Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);

// Safe default status from coverage %; the engine's billCoverage will own this later.
const statusFor = (pct, paid) => (paid ? 'paid' : pct >= 100 ? 'covered' : pct >= 50 ? 'on-track' : 'at-risk');

function billOut(b) {
  const coveredPct = b.paid ? 100 : b.amount ? Math.round((b.covered_amt / b.amount) * 100) : 0;
  return {
    id: b.id, name: b.name, amount: b.amount, dueDate: b.due_date,
    repeat: b.repeat, mustPay: !!b.must_pay, paid: !!b.paid,
    daysLeft: daysBetween(TODAY, b.due_date), coveredPct, status: statusFor(coveredPct, b.paid),
  };
}

const allBills = () => db.prepare('SELECT * FROM bills ORDER BY due_date, id').all();
const reserveState = () => db.prepare('SELECT balance,target,buffer FROM reserve_state WHERE id=1').get();

function entryOut(e) {
  return {
    date: e.date, gross: e.gross, fuel: e.fuel, otherCosts: e.other_costs, net: e.net,
    split: { bills: e.bills_amt, reserve: e.reserve_amt, spend: e.spend_amt },
  };
}

const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

module.exports = { ESSENTIAL_DAILY_COST, daysBetween, billOut, allBills, reserveState, entryOut, bad, isDate };
