// Repro buildLedgerEntries for one farmer + check opening carry per cycle.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

await mongoose.connect(process.env.MONGODB_URI);
const FP = mongoose.connection.collection('farmerpayments');
const PO = mongoose.connection.collection('produceropenings');

const target = '69db29286b5851d0478bb464';
const farmerTarget = '69db29d66b5851d0478bb56f';
const cObjId = new mongoose.Types.ObjectId(target);
const fObjId = new mongoose.Types.ObjectId(farmerTarget);

const opening = (await PO.findOne({ companyId: cObjId, farmerId: fObjId }))?.cfAdvance ?? 0;
console.log(`Opening: ${opening}\n`);

async function ledger(start, end) {
  start = new Date(start);
  end = new Date(end); end.setHours(23,59,59,999);
  const cycleFilter = {
    $or: [
      { 'paymentPeriod.toDate': { $gte: start, $lte: end } },
      { 'paymentPeriod.toDate': { $exists: false }, paymentDate: { $gte: start, $lte: end } },
      { 'paymentPeriod.toDate': null, paymentDate: { $gte: start, $lte: end } },
    ],
  };
  const docs = await FP.find({
    farmerId: fObjId,
    companyId: cObjId,
    status: { $ne: 'Cancelled' },
    'deductions.type': { $in: ['CF Advance', 'Cattle Feed', 'CF Recovery'] },
    ...cycleFilter,
  }).toArray();
  let debit = 0;
  for (const p of docs) {
    for (const d of p.deductions || []) {
      if (['CF Advance','Cattle Feed','CF Recovery'].includes(d.type)) debit += d.amount || 0;
    }
  }
  return debit;
}

async function showPeriod(label, from, to) {
  const priorDebit = await ledger('2000-01-01', new Date(new Date(from).getTime() - 86400000));
  const periodDebit = await ledger(from, to);
  const effOpening = opening - priorDebit;
  const closing = effOpening - periodDebit;
  console.log(`${label}  ${from} → ${to}`);
  console.log(`  effective opening (carry): ${effOpening}`);
  console.log(`  period debit: ${periodDebit}`);
  console.log(`  closing: ${closing}\n`);
}

await showPeriod('Cycle 1', '2026-04-01', '2026-04-15');
await showPeriod('Cycle 2', '2026-04-16', '2026-04-30');
await showPeriod('Cycle 3', '2026-05-01', '2026-05-15');

await mongoose.disconnect();
