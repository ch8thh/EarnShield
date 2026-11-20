// SQLite setup: schema + demo seed (driver Ravi Kumar, "today" = 20 Nov 2026).
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'earnshield.db');
if (DB_PATH !== ':memory:') fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const DRIVER = { name: 'Ravi Kumar' };
const TODAY = '2026-11-20';

db.exec(`
CREATE TABLE IF NOT EXISTS entries (
  date        TEXT PRIMARY KEY,          -- YYYY-MM-DD
  gross       REAL NOT NULL,
  fuel        REAL NOT NULL DEFAULT 0,
  other_costs REAL NOT NULL DEFAULT 0,
  net         REAL NOT NULL,
  bills_amt   REAL NOT NULL DEFAULT 0,
  reserve_amt REAL NOT NULL DEFAULT 0,
  spend_amt   REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS bills (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  amount      REAL NOT NULL,
  due_date    TEXT NOT NULL,             -- YYYY-MM-DD
  "repeat"    TEXT NOT NULL DEFAULT 'none', -- none | weekly | monthly
  must_pay    INTEGER NOT NULL DEFAULT 1,
  paid        INTEGER NOT NULL DEFAULT 0,
  covered_amt REAL NOT NULL DEFAULT 0    -- rupees set aside so far (<= amount)
);
CREATE TABLE IF NOT EXISTS reserve_state (
  id      INTEGER PRIMARY KEY CHECK (id = 1),
  balance REAL NOT NULL,
  target  REAL NOT NULL,
  buffer  REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS buffer_events (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  date   TEXT NOT NULL,
  type   TEXT NOT NULL,                  -- deposit | withdraw | rebuild
  amount REAL NOT NULL,
  reason TEXT
);
CREATE TABLE IF NOT EXISTS entry_bill_alloc (   -- how each entry's bills share was spread (for exact undo)
  date    TEXT NOT NULL,
  bill_id INTEGER NOT NULL,
  amount  REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  language       TEXT NOT NULL DEFAULT 'en',
  reserve_mode   TEXT NOT NULL DEFAULT 'auto',
  weather_alerts INTEGER NOT NULL DEFAULT 1
);
`);

// Nets for the 14 days before today (6..19 Nov): range 900-2000, average 1150.
const EARLIER_NETS = [920, 1000, 1080, 950, 2000, 900, 1100, 1020, 960, 1150, 1180, 1800, 1040, 1000];

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const seed = db.transaction(() => {
  for (const t of ['entries', 'bills', 'reserve_state', 'buffer_events', 'settings', 'entry_bill_alloc']) db.exec(`DELETE FROM ${t}`);
  db.exec(`DELETE FROM sqlite_sequence WHERE name IN ('bills','buffer_events')`);

  const ins = db.prepare(`INSERT INTO entries (date,gross,fuel,other_costs,net,bills_amt,reserve_amt,spend_amt)
                          VALUES (?,?,?,?,?,?,?,?)`);
  EARLIER_NETS.forEach((net, i) => {
    const date = addDays(TODAY, -(EARLIER_NETS.length - i));
    const fuel = Math.round((net * 0.3) / 10) * 10;
    const other = Math.round((net * 0.1) / 10) * 10;
    // Earlier days use a flat 40/20/40 split.
    ins.run(date, net + fuel + other, fuel, other, net, net * 0.4, net * 0.2, net * 0.4);
  });
  ins.run(TODAY, 1850, 420, 130, 1300, 520, 260, 520);

  const bill = db.prepare(`INSERT INTO bills (name,amount,due_date,"repeat",must_pay,paid,covered_amt)
                           VALUES (?,?,?,?,?,0,?)`);
  bill.run('Mobile recharge', 299, '2026-11-24', 'monthly', 1, 299);   // 100%
  bill.run('Room rent', 6500, '2026-12-01', 'monthly', 1, 5200);       // 80%
  bill.run('Auto loan EMI', 4200, '2026-12-05', 'monthly', 1, 2310);   // 55%
  bill.run('School fees', 1800, '2026-12-10', 'none', 1, 540);         // 30%

  db.prepare(`INSERT INTO reserve_state (id,balance,target,buffer) VALUES (1,8400,15000,3000)`).run();

  const ev = db.prepare(`INSERT INTO buffer_events (date,type,amount,reason) VALUES (?,?,?,?)`);
  ev.run('2026-11-12', 'deposit', 180, 'Daily reserve');
  ev.run('2026-11-15', 'withdraw', 1500, 'Auto repair');
  ev.run('2026-11-20', 'deposit', 260, 'Daily reserve');

  db.prepare(`INSERT INTO settings (id,language,reserve_mode,weather_alerts) VALUES (1,'en','auto',1)`).run();
});

function resetSeed() { seed(); }

const hasData = db.prepare('SELECT COUNT(*) c FROM settings').get().c > 0;
if (!hasData) seed();

module.exports = { db, resetSeed, DRIVER, TODAY };
