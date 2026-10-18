import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ledger from '../models/Ledger.js';
import Voucher from '../models/Voucher.js';
import Company from '../models/Company.js';
import { getNextSequence } from '../models/Counter.js';
import { seedDairyLedgersForCompany } from './seedDairyLedgers.js';

dotenv.config();

// ── Demo data for Accounts reports (R&D, Cash Book, Day Book, GL, Ledger
// Abstract, Trial Balance, P&L, Balance Sheet). Everything is posted as
// vouchers, so every voucher-driven report picks it up.
//
// Usage:  node src/scripts/seedReportsDemoData.js            (first company)
//         COMPANY_ID=<id> node src/scripts/seedReportsDemoData.js
//         ... --reset   removes previously seeded demo vouchers first
//
// Seeded vouchers carry referenceNumber 'DEMO-SEED' so --reset can find them.

const DEMO_TAG = 'DEMO-SEED';
const FROM = new Date(Date.UTC(2026, 3, 1));        // 1 Apr 2026 (FY 26-27)
const TO   = new Date(Date.UTC(2026, 9, 18));       // 18 Oct 2026

const PREFIX = { Receipt: 'RV', Payment: 'PV', Journal: 'JV', Contra: 'CT' };

// Deterministic PRNG so re-runs give the same figures
let seed = 20260401;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const amt = (min, max, step = 10) => Math.round((min + rand() * (max - min)) / step) * step;

// Ledgers the R&D needs that the standard chart doesn't carry
// (R&D / Cash Book recognise only ledgerType 'Cash' and 'Bank').
const EXTRA_LEDGERS = [
  { ledgerName: 'CASH IN HAND',     ledgerType: 'Cash', parentGroup: 'ASSET', voucherType: 'B', openingBalance: 50000,  openingBalanceType: 'Dr' },
  { ledgerName: 'SBI CURRENT A/C',  ledgerType: 'Bank', parentGroup: 'ASSET', voucherType: 'B', openingBalance: 125000, openingBalanceType: 'Dr' },
];

// Opening balances (Dr side = Cr side = 2,50,000 incl. cash + bank above)
const OPENINGS = {
  'BUILDINGS':     { openingBalance: 75000,  openingBalanceType: 'Dr' },
  'SHARE CAPITAL': { openingBalance: 120000, openingBalanceType: 'Cr' },
  'RESERVE FUND':  { openingBalance: 80000,  openingBalanceType: 'Cr' },
  'BUILDING FUND': { openingBalance: 50000,  openingBalanceType: 'Cr' },
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const company = process.env.COMPANY_ID
    ? await Company.findById(process.env.COMPANY_ID)
    : await Company.findOne().sort({ createdAt: 1 });
  if (!company) throw new Error('No company found');
  const companyId = company._id;
  console.log(`Company: ${company.companyName} (${companyId})`);

  if (process.argv.includes('--reset')) {
    const del = await Voucher.deleteMany({ companyId, referenceNumber: DEMO_TAG });
    console.log(`Removed ${del.deletedCount} old demo vouchers`);
    // Restart voucher numbering only when nothing else uses the counters
    if (!(await Voucher.exists({ companyId }))) {
      await mongoose.connection.db.collection('counters')
        .deleteMany({ _id: { $regex: `^voucher-(RV|PV|JV|CT)\\d{4}-${companyId}$` } });
    }
  } else if (await Voucher.exists({ companyId, referenceNumber: DEMO_TAG })) {
    console.log('Demo vouchers already exist — run with --reset to recreate');
    await mongoose.disconnect();
    return;
  }

  const ledgerRes = await seedDairyLedgersForCompany(companyId);
  console.log(`Chart of accounts: ${ledgerRes.created} created, ${ledgerRes.skipped} existed`);

  for (const def of EXTRA_LEDGERS) {
    await Ledger.updateOne(
      { ledgerName: def.ledgerName, companyId },
      { $setOnInsert: { ...def, currentBalance: def.openingBalance, balanceType: 'Dr', status: 'Active', companyId } },
      { upsert: true }
    );
  }
  for (const [name, ob] of Object.entries(OPENINGS)) {
    await Ledger.updateOne({ ledgerName: name, companyId }, { $set: ob });
  }

  const ledgers = await Ledger.find({ companyId }).lean();
  const L = Object.fromEntries(ledgers.map(l => [l.ledgerName, l]));
  const need = n => { if (!L[n]) throw new Error(`Ledger missing: ${n}`); return L[n]; };
  const CASH = 'CASH IN HAND', BANK = 'SBI CURRENT A/C';

  const docs = [];
  // dr/cr: [[ledgerName, amount], ...]
  const post = async (type, date, dr, cr, narration, extra = {}) => {
    const yymm = `${String(date.getUTCFullYear()).slice(-2)}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const pattern = `${PREFIX[type]}${yymm}`;
    const seq = await getNextSequence(`voucher-${pattern}-${companyId}`, 0);
    const entries = [
      ...dr.map(([n, a]) => ({ ledgerId: need(n)._id, ledgerName: n, debitAmount: a, creditAmount: 0, narration })),
      ...cr.map(([n, a]) => ({ ledgerId: need(n)._id, ledgerName: n, debitAmount: 0, creditAmount: a, narration })),
    ];
    const total = dr.reduce((s, [, a]) => s + a, 0);
    docs.push({
      voucherType: type,
      voucherNumber: `${pattern}${String(seq).padStart(4, '0')}`,
      voucherDate: date,
      entries,
      totalDebit: total,
      totalCredit: total,
      narration,
      status: 'Posted',
      referenceType: 'Manual',
      referenceNumber: DEMO_TAG,
      companyId,
      ...extra,
    });
  };
  const receipt = (d, into, from, a, n) => post('Receipt', d, [[into, a]], [[from, a]], n);
  const payment = (d, to, outOf, a, n) => post('Payment', d, [[to, a]], [[outOf, a]], n);

  let milkBillDue = 0;
  for (let d = new Date(FROM); d <= TO; d = new Date(d.getTime() + 86400000)) {
    const day = d.getUTCDate();
    const month = d.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' });

    // Daily: local milk sales in cash, milk procurement accrued to producers
    await receipt(d, CASH, 'LOCAL SALES', amt(1800, 3600), 'Local milk sales');
    const milkValue = amt(14000, 19000, 50);
    milkBillDue += milkValue;
    await post('Journal', d, [['MILK PURCHASE', milkValue]], [['PRODUCERS DUES', milkValue]], 'Milk procurement value', { isMilkBill: true });
    if (day % 3 === 0) await receipt(d, CASH, 'SAMPLE SALES', amt(150, 400), 'Sample milk sales');

    // Union sales settled into bank every 5 days
    if (day % 5 === 0) await receipt(d, BANK, 'UNION SALES', amt(80000, 98000, 100), 'Milma union milk value received');

    // Milk bill paid every 10 days — mostly bank, part cash
    if (day === 10 || day === 20 || (day === 30) || (day === 28 && d.getUTCMonth() === 1)) {
      const cashPart = Math.round(milkBillDue * 0.15 / 10) * 10;
      await post('Contra', d, [[CASH, cashPart]], [[BANK, cashPart]], 'Cash withdrawn from bank');
      await payment(d, 'PRODUCERS DUES', BANK, milkBillDue - cashPart, 'Milk bill payment to producers (bank)');
      await payment(d, 'PRODUCERS DUES', CASH, cashPart, 'Milk bill payment to producers (cash)');
      milkBillDue = 0;
    }

    // Cash deposited into bank every Saturday
    if (d.getUTCDay() === 6) await post('Contra', d, [[BANK, 25000]], [[CASH, 25000]], 'Cash deposited into bank');

    // Cattle feed trade: purchased via bank, sold for cash
    if (day === 3 || day === 18) {
      const cost = amt(22000, 30000, 100);
      await payment(d, 'CATTLE FEED PURCHASE', BANK, cost, 'Cattle feed purchase');
      await receipt(d, CASH, 'CATTLE FEED SALES', Math.round(cost * 1.06 / 10) * 10, 'Cattle feed sales');
    }
    if (day === 7)  await payment(d, 'CATTLE FEED ADVANCE', CASH, amt(3000, 6000, 100), 'Cattle feed advance to farmers');
    if (day === 22) await receipt(d, CASH, 'CATTLE FEED ADVANCE', amt(2500, 5000, 100), 'Cattle feed advance recovered');
    if (day === 12) await receipt(d, CASH, 'MINERALS SALES', amt(1500, 3000), 'Mineral mixture sales');
    if (day === 12) await payment(d, 'MINERALS PURCHASE', CASH, amt(1200, 2500), 'Mineral mixture purchase');

    // Monthly establishment & contingencies
    if (day === 1) {
      await payment(d, 'SALARY & ALLOWANCES', CASH, 18000, `Staff salary ${month}`);
      await payment(d, 'DAILY WAGES', CASH, amt(3000, 4500, 100), 'Daily wages');
      await post('Journal', d, [['EPF DCS CONTRIBUTION', 1800]], [['EMPLOYEES PROVIDENT FUND', 1800]], 'EPF society contribution');
    }
    if (day === 5)  await payment(d, 'EMPLOYEES PROVIDENT FUND', BANK, 3600, 'EPF remittance');
    if (day === 8)  await payment(d, 'ELECTRICITY CHARGES', CASH, amt(900, 1400), 'Office electricity bill');
    if (day === 8)  await payment(d, 'BMC ELECTRICITY CHARGES', BANK, amt(6000, 9000, 100), 'BMC electricity bill');
    if (day === 14) await payment(d, 'PRINTING & STATIONERY', CASH, amt(400, 1200), 'Printing & stationery');
    if (day === 15) await payment(d, 'TELEPHONE CHARGES', CASH, amt(300, 600), 'Telephone & internet');
    if (day === 16) await payment(d, 'TRANSPORTING CHARGES', CASH, amt(2500, 4000, 100), 'Milk transporting charges');
    if (day === 21) await payment(d, 'BMC FUEL CHARGES', CASH, amt(1500, 2500), 'Generator fuel for BMC');
    if (day === 25) await payment(d, 'OFFICE EXPENSES', CASH, amt(300, 900), 'Office expenses');
    if (day === 26) await payment(d, 'REPAIRS & MAINTENANCE', CASH, amt(500, 3000, 100), 'Repairs & maintenance');
    if (day === 27) await receipt(d, BANK, 'BMC CHILLING COST (RECEIPTS)', amt(4000, 6000, 100), 'BMC chilling cost received');
    if (day === 28) await payment(d, 'BANK CHARGES', BANK, amt(50, 250), 'Bank charges');
    if (day === 28 && d.getUTCMonth() % 3 === 2) await receipt(d, BANK, 'INTEREST RECEIVED', amt(1500, 3000), 'Quarterly SB interest');

    // Members: share capital & advances
    if (day === 11) await receipt(d, CASH, 'SHARE CAPITAL', amt(1000, 3000, 100), 'Share capital collected from new members');
    if (day === 19) await payment(d, 'FARMER ADVANCE', CASH, amt(2000, 5000, 100), 'Advance repaid to farmers');
    if (day === 4)  await receipt(d, CASH, 'FARMER ADVANCE', amt(3000, 6000, 100), 'Advance received from farmers');
    if (day === 9 && d.getUTCMonth() === 5) await payment(d, 'COMPUTER & ACCESSORIES', BANK, 42000, 'Computer purchased for office');
    if (day === 17 && d.getUTCMonth() === 7) await payment(d, 'AUDIT FEE', BANK, 8500, 'Audit fee FY 25-26');
  }

  await Voucher.insertMany(docs);
  console.log(`Inserted ${docs.length} demo vouchers (${FROM.toISOString().slice(0, 10)} → ${TO.toISOString().slice(0, 10)})`);

  // Keep Ledger.currentBalance in step with the posted vouchers
  const sums = await Voucher.aggregate([
    { $match: { companyId, status: 'Posted' } },
    { $unwind: '$entries' },
    { $group: { _id: '$entries.ledgerId', dr: { $sum: '$entries.debitAmount' }, cr: { $sum: '$entries.creditAmount' } } },
  ]);
  const sumMap = Object.fromEntries(sums.map(s => [s._id.toString(), s]));
  for (const l of await Ledger.find({ companyId })) {
    const s = sumMap[l._id.toString()] || { dr: 0, cr: 0 };
    const obSigned = (l.openingBalance || 0) * (l.openingBalanceType === 'Cr' ? -1 : 1);
    const net = obSigned + s.dr - s.cr; // +ve = Dr
    const drNormal = ['ASSET', 'EXPENSE'].includes(l.parentGroup) || ['Cash', 'Bank'].includes(l.ledgerType);
    l.currentBalance = drNormal ? net : -net;
    l.balanceType = net >= 0 ? 'Dr' : 'Cr';
    await l.save();
  }

  const cb = await Ledger.find({ companyId, ledgerType: { $in: ['Cash', 'Bank'] } }).lean();
  cb.forEach(l => console.log(`  ${l.ledgerName}: ${l.currentBalance.toFixed(2)} ${l.balanceType}`));
  await mongoose.disconnect();
}

run().catch(async err => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
