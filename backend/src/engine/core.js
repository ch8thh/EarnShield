// Engine core. ALL STUBS: return sample values with the final signatures.
// Implementation owner: replace the bodies, keep the signatures.

/**
 * @param {{gross:number,fuel:number,otherCosts:number,recentNets:number[],bills:object[],today:string}} input
 * @returns {{net:number,split:{bills:number,reserve:number,spend:number},reservePct:number,explanation:string[]}}
 */
function computeDay({ gross, fuel, otherCosts, recentNets, bills, today } = {}) {
  // TODO: net = gross - fuel - otherCosts; split net into bills/reserve/spend using
  // recentNets variability and upcoming bills; reservePct = reserve balance / target.
  return {
    net: 1300,
    split: { bills: 520, reserve: 260, spend: 520 },
    reservePct: 56,
    explanation: [
      'You earned ₹1,850 and spent ₹550 on fuel and other costs, so your net is ₹1,300.',
      '₹520 goes to upcoming bills, ₹260 to your reserve, and ₹520 is safe to spend.',
    ],
  };
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
