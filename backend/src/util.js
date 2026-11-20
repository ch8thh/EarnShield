const { db, TODAY } = require('./db');
const { billCoverage } = require('./engine/core');

// Rupees/day the driver needs for essentials (food, rent share, phone). Fixed demo value for now;
// there is no settings column for it yet. Keep the name: runway calculations depend on it.
const ESSENTIAL_DAILY_COST = 600;

const daysBetween = (from, to) =>
  Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);

// Coverage % and status come from the engine. A single bill is covered by exactly what was set aside for it.
function billOut(b) {
  const { coveredPct, status } = billCoverage([b], b.covered_amt)[0];
  return {
    id: b.id, name: b.name, amount: b.amount, dueDate: b.due_date,
    repeat: b.repeat, mustPay: !!b.must_pay, paid: !!b.paid,
    daysLeft: daysBetween(TODAY, b.due_date), coveredPct, status,
  };
}

const allBills = () => db.prepare('SELECT * FROM bills ORDER BY due_date, id').all();
// Rupees currently set aside for unpaid bills.
const protectedPool = () => db.prepare('SELECT COALESCE(SUM(covered_amt),0) t FROM bills WHERE paid=0').get().t;
const reserveState = () => db.prepare('SELECT balance,target,buffer FROM reserve_state WHERE id=1').get();

function entryOut(e) {
  return {
    date: e.date, gross: e.gross, fuel: e.fuel, otherCosts: e.other_costs, net: e.net,
    split: { bills: e.bills_amt, reserve: e.reserve_amt, spend: e.spend_amt },
  };
}

const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

module.exports = { ESSENTIAL_DAILY_COST, daysBetween, billOut, allBills, protectedPool, reserveState, entryOut, bad, isDate };
