import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ledger from '../models/Ledger.js';
import Voucher from '../models/Voucher.js';
import Company from '../models/Company.js';

dotenv.config();

// ── Demo union bills for the Milk Bill Abstract (Union Bill Tabular Report).
// One Adjustment (Journal) Entry per union bill date — 5th, 15th, 25th of
// each month, 1 Apr 2026 → 18 Oct 2026 — saved with "Milk Bill" ticked.
// Payment (Cr) side = the union bill heads; Receipt (Dr) side = MILMA UNION.
//
// Usage:  node src/scripts/seedUnionBillDemo.js            (first company)
//         COMPANY_ID=<id> node src/scripts/seedUnionBillDemo.js
//         ... --reset   removes previously seeded union bills (and the
//                       ledgers this script created, if nothing else uses them)
//
// Seeded vouchers carry referenceNumber 'UNION-BILL-DEMO'. Ledger balances
// are not touched — demo rows only.

const DEMO_TAG = 'UNION-BILL-DEMO';
// Ledger has no free-text field, so created ledgers get a raw 'seedTag'.
const FROM = new Date(2026, 3, 1);
const TO   = new Date(2026, 9, 18);

const DR_LEDGER = 'MILMA UNION';
const HEADS = [
  'FLOOD RELIEF FUND', 'LIC GI PREMIUM', 'MILK VALUE ADDL PRICE ADVANCE', 'MILMA FEEDS',
  'MINERALS FACTORY', 'MRDF', 'ROUNDING DIFFERENCE PAYMENT', 'SHARE IN MILMA',
  'SILAGE FACTORY', 'UNION BANK A/C'
];

// Deterministic PRNG so re-runs give the same figures
let seed = 20260405;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const between = (min, max, step = 1) => Math.round((min + rand() * (max - min)) / step) * step;
const chance = (p) => rand() < p;

// Reference PDF figures for the first rows; the rest are generated.
const FIXED = {
  '2026-04-15': { 'UNION BANK A/C': 105419 },
  '2026-04-25': { 'MILK VALUE ADDL PRICE ADVANCE': 18720, 'UNION BANK A/C': 96293 },
  '2026-05-15': { 'ROUNDING DIFFERENCE PAYMENT': 0.47, 'UNION BANK A/C': 82083 },
  '2026-08-05': { 'MILMA FEEDS': 21300, 'ROUNDING DIFFERENCE PAYMENT': 0.15, 'SHARE IN MILMA': 96.5, 'UNION BANK A/C': 110893 },
  '2026-10-15': { 'MILMA FEEDS': 19800, 'ROUNDING DIFFERENCE PAYMENT': 0.11, 'UNION BANK A/C': 129246 }
};

const generated = (day) => {
  const a = { 'UNION BANK A/C': between(78000, 135000) };
  if (day === 25 && chance(0.7)) a['MILK VALUE ADDL PRICE ADVANCE'] = between(12000, 22000, 10);
  if (chance(0.45)) a['MILMA FEEDS'] = between(15000, 24000, 100);
  if (chance(0.25)) a['MINERALS FACTORY'] = between(1500, 4500, 10);
  if (chance(0.2))  a['SILAGE FACTORY'] = between(2000, 6000, 10);
  if (day === 5 && chance(0.6)) a['MRDF'] = between(800, 2500, 10);
  if (day === 5 && chance(0.4)) a['LIC GI PREMIUM'] = between(1200, 3600, 10);
  if (chance(0.15)) a['FLOOD RELIEF FUND'] = between(500, 2000, 50);
  if (chance(0.35)) a['SHARE IN MILMA'] = between(50, 400) + 0.5;
  if (chance(0.5))  a['ROUNDING DIFFERENCE PAYMENT'] = between(1, 49) / 100;
  return a;
};

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const company = process.env.COMPANY_ID
    ? await Company.findById(process.env.COMPANY_ID)
    : await Company.findOne().sort({ createdAt: 1 });
  if (!company) throw new Error('No company found');
  const companyId = company._id;
  console.log(`Company: ${company.companyName} (${companyId})`);

  const removed = await Voucher.deleteMany({ companyId, referenceNumber: DEMO_TAG });
  if (removed.deletedCount) console.log(`Removed ${removed.deletedCount} earlier demo union bills`);

  // The reports demo (DEMO-SEED) ticks Milk Bill on its daily Milk Purchase
  // entries, which would add ~200 PRODUCERS DUES rows to this report. Untick
  // them while the union bill demo is in place; --reset restores them.
  if (process.argv.includes('--reset')) {
    const restored = await Voucher.collection.updateMany(
      { companyId, milkBillHiddenBy: DEMO_TAG },
      { $set: { isMilkBill: true }, $unset: { milkBillHiddenBy: '' } });
    if (restored.modifiedCount) console.log(`Re-ticked Milk Bill on ${restored.modifiedCount} DEMO-SEED entries`);
  } else {
    const hidden = await Voucher.collection.updateMany(
      { companyId, referenceNumber: 'DEMO-SEED', isMilkBill: true },
      { $set: { isMilkBill: false, milkBillHiddenBy: DEMO_TAG } });
    if (hidden.modifiedCount) console.log(`Unticked Milk Bill on ${hidden.modifiedCount} DEMO-SEED entries`);
  }

  if (process.argv.includes('--reset')) {
    const created = await Ledger.collection.find({ companyId, seedTag: DEMO_TAG }).toArray();
    for (const l of created) {
      if (!(await Voucher.exists({ companyId, 'entries.ledgerId': l._id }))) {
        await Ledger.collection.deleteOne({ _id: l._id });
        console.log(`Removed ledger ${l.ledgerName}`);
      }
    }
    await mongoose.disconnect();
    return;
  }

  // Ledgers: reuse existing ones, create the missing heads (Liability, B).
  const ledgers = {};
  for (const name of [DR_LEDGER, ...HEADS]) {
    let l = await Ledger.findOne({ companyId, ledgerName: name });
    if (!l) {
      l = await Ledger.create({
        companyId, ledgerName: name, ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY',
        voucherType: 'B', openingBalance: 0, openingBalanceType: 'Cr', balanceType: 'Cr'
      });
      await Ledger.collection.updateOne({ _id: l._id }, { $set: { seedTag: DEMO_TAG } });
      console.log(`Created ledger ${name}`);
    }
    ledgers[name] = l;
  }

  const docs = [];
  let seq = 0;
  for (let m = new Date(FROM); m <= TO; m.setMonth(m.getMonth() + 1)) {
    for (const day of [5, 15, 25]) {
      const date = new Date(m.getFullYear(), m.getMonth(), day);
      if (date < FROM || date > TO) continue;
      const amounts = FIXED[ymd(date)] || generated(day);
      const credits = HEADS.filter(h => amounts[h]).map(h => ({
        ledgerId: ledgers[h]._id, ledgerName: h, debitAmount: 0, creditAmount: amounts[h], narration: 'Union bill'
      }));
      const total = Math.round(credits.reduce((s, e) => s + e.creditAmount, 0) * 100) / 100;
      docs.push({
        companyId,
        voucherType: 'Journal',
        voucherNumber: `JVUB${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(++seq).padStart(3, '0')}`,
        voucherDate: date,
        entries: [
          { ledgerId: ledgers[DR_LEDGER]._id, ledgerName: DR_LEDGER, debitAmount: total, creditAmount: 0, narration: 'Union bill' },
          ...credits
        ],
        totalDebit: total,
        totalCredit: total,
        narration: `Union bill ${ymd(date)} (demo)`,
        isMilkBill: true,
        status: 'Posted',
        referenceType: 'Manual',
        referenceNumber: DEMO_TAG
      });
    }
  }
  await Voucher.insertMany(docs);
  console.log(`Inserted ${docs.length} demo union bills (${ymd(FROM)} → ${ymd(TO)})`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
