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

/**
 * @param {object[]} bills
 * @param {number} protectedPool rupees available to cover bills
 * @returns {{bill:object,coveredPct:number,status:string}[]}
 */
function billCoverage(bills, protectedPool) {
  // TODO: allocate protectedPool across bills by due date / mustPay priority.
  const sample = { 'Mobile recharge': 100, 'Room rent': 80, 'Auto loan EMI': 55, 'School fees': 30 };
  return (bills || []).map((bill) => {
    const coveredPct = sample[bill.name] ?? 0;
    const status = coveredPct >= 100 ? 'covered' : coveredPct >= 50 ? 'on-track' : 'at-risk';
    return { bill, coveredPct, status };
  });
}

/**
 * @param {number} reserve current reserve balance (rupees)
 * @param {number} essentialDailyCost rupees/day needed for essentials
 * @returns {number} days
 */
function runwayDays(reserve, essentialDailyCost) {
  // TODO: Math.floor(reserve / essentialDailyCost) with guards (cost <= 0).
  return 14;
}

module.exports = { computeDay, billCoverage, runwayDays };
