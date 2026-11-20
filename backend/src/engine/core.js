// Engine core. computeDay is implemented; billCoverage and runwayDays are still stubs.

const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const round2 = (n) => Math.round(n * 100) / 100;

// Split percentages [bills, reserve, spend] by kind of day (ratio = net / recent average).
const SPLITS = { low: [50, 20, 30], normal: [40, 20, 40], high: [35, 30, 35] };
const LOW_RATIO = 0.8;
const HIGH_RATIO = 1.3;

const dayDiff = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);

/**
 * Pure: no DB access, no clock.
 * @param {{gross:number,fuel:number,otherCosts:number,recentNets:number[],bills:object[],today:string}} input
 * @returns {{net:number,split:{bills:number,reserve:number,spend:number},reservePct:number,explanation:string[]}}
 */
function computeDay({ gross = 0, fuel = 0, otherCosts = 0, recentNets = [], bills = [], today } = {}) {
  const net = round2(gross - fuel - otherCosts);
  const costLine = `You earned ${inr(gross)} and spent ${inr(fuel + otherCosts)} on fuel and other costs, so your net is ${inr(net)}.`;
  if (net <= 0) {
    return {
      net,
      split: { bills: 0, reserve: 0, spend: 0 },
      reservePct: 0,
      explanation: [
        costLine,
        'No money is set aside today because your costs were as much as your earnings. Your bills and reserve stay as they were.',
      ],
    };
  }

  const nets = (recentNets || []).filter((n) => typeof n === 'number');
  const avg = nets.length ? nets.reduce((a, b) => a + b, 0) / nets.length : 0;
  const ratio = avg > 0 ? net / avg : 1;
  const kind = avg > 0 && ratio < LOW_RATIO ? 'low' : avg > 0 && ratio > HIGH_RATIO ? 'high' : 'normal';
  const [bp, rp, sp] = SPLITS[kind];

  const billsAmt = Math.round((net * bp) / 100);
  const reserveAmt = Math.round((net * rp) / 100);
  const spend = round2(net - billsAmt - reserveAmt);
  const reservePct = Math.round((reserveAmt / net) * 100);

  const why = {
    normal: avg > 0
      ? `This was a normal day (your recent average is ${inr(avg)}), so the usual ${bp}/${rp}/${sp} split applies.`
      : `There is no earlier history yet, so the usual ${bp}/${rp}/${sp} split applies.`,
    low: `This was a slower day than usual (your recent average is ${inr(avg)}), so more goes to bills (${bp}%) to keep them safe and less to spend (${sp}%).`,
    high: `This was a strong day, well above your recent average of ${inr(avg)}, so more goes to your reserve (${rp}%) to help you through slower days.`,
  }[kind];

  const unpaid = (bills || []).filter((b) => !b.paid && b.due_date).sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  let billLine = `${inr(billsAmt)} is protected for bills, ${inr(reserveAmt)} goes to your reserve, and ${inr(spend)} is safe to spend.`;
  if (unpaid.length && today) {
    const next = unpaid[0];
    const d = dayDiff(today, next.due_date);
    const when = d < 0 ? 'overdue' : d === 0 ? 'due today' : d === 1 ? 'due tomorrow' : `due in ${d} days`;
    billLine += ` Your next bill is ${next.name} (${inr(next.amount)}, ${when}).`;
  }
  return { net, split: { bills: billsAmt, reserve: reserveAmt, spend }, reservePct, explanation: [costLine, why, billLine] };
}

const statusOf = (pct) => (pct >= 100 ? 'covered' : pct >= 50 ? 'on-track' : 'at-risk');
const num = (v) => (Number.isFinite(v) ? v : 0);

/**
 * Allocate the protected pool across bills. Each unpaid bill's target is its
 * covered_amt (capped at amount); if the targets exceed the pool, coverage is
 * shrunk from the lowest-priority bill first (priority: must_pay, then earliest due_date).
 * @param {object[]} bills DB rows {id,name,amount,due_date,repeat,must_pay,paid,covered_amt}
 * @param {number} protectedPool rupees available to cover bills (missing/negative = 0)
 * @returns {{bill:object,coveredPct:number,status:string}[]} same order as input
 */
function billCoverage(bills, protectedPool) {
  const list = Array.isArray(bills) ? bills : [];
  const pool = Math.max(0, num(protectedPool));
  const cover = list.map((b) => (b.paid ? null : Math.max(0, Math.min(num(b.covered_amt), num(b.amount)))));

  let excess = cover.reduce((a, c) => a + (c || 0), 0) - pool;
  if (excess > 0) {
    const order = list
      .map((b, i) => i)
      .filter((i) => cover[i] !== null)
      .sort((i, j) => {
        const a = list[i], b = list[j];
        return (!!b.must_pay - !!a.must_pay) ||
          String(a.due_date ?? '').localeCompare(String(b.due_date ?? '')) || i - j;
      });
    for (let k = order.length - 1; k >= 0 && excess > 0; k--) {
      const cut = Math.min(cover[order[k]], excess);
      cover[order[k]] -= cut;
      excess -= cut;
    }
  }

  return list.map((bill, i) => {
    if (bill.paid) return { bill, coveredPct: 100, status: 'paid' };
    const amount = num(bill.amount);
    // A zero-amount bill owes nothing, so it counts as fully covered.
    const coveredPct = amount > 0 ? Math.round((cover[i] / amount) * 100) : 100;
    return { bill, coveredPct, status: statusOf(coveredPct) };
  });
}

/**
 * @param {number} reserve current reserve balance (rupees)
 * @param {number} essentialDailyCost rupees/day needed for essentials
 * @returns {number} whole days of runway (0 for invalid or non-positive inputs)
 */
function runwayDays(reserve, essentialDailyCost) {
  if (!Number.isFinite(reserve) || !Number.isFinite(essentialDailyCost)) return 0;
  if (reserve <= 0 || essentialDailyCost <= 0) return 0;
  return Math.floor(reserve / essentialDailyCost);
}

module.exports = { computeDay, billCoverage, runwayDays };
