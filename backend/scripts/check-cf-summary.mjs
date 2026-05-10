// Verify Summary opening/credit/debit/balance month by month.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

await mongoose.connect(process.env.MONGODB_URI);
const FP = mongoose.connection.collection('farmerpayments');
const PO = mongoose.connection.collection('produceropenings');
const SL = mongoose.connection.collection('sales');
const PR = mongoose.connection.collection('producerreceipts');

const target = '69db29286b5851d0478bb464';
const farmerTarget = '69db29d66b5851d0478bb56f';
const cObjId = new mongoose.Types.ObjectId(target);
const fObjId = new mongoose.Types.ObjectId(farmerTarget);

const baseOpening = (await PO.findOne({ companyId: cObjId, farmerId: fObjId }))?.cfAdvance ?? 0;

const cfTypes = ['CF Advance','Cattle Feed','CF Recovery'];
async function debit(filterDate) {
  const agg = await FP.aggregate([
    { $match: { companyId: cObjId, farmerId: fObjId, status: { $ne: 'Cancelled' }, 'deductions.type': { $in: cfTypes }, ...filterDate } },
    { $unwind: '$deductions' },
    { $match: { 'deductions.type': { $in: cfTypes } } },
    { $group: { _id: null, total: { $sum: '$deductions.amount' } } },
  ]).toArray();
  return agg[0]?.total ?? 0;
}
async function credit(filterDate) {
  const agg = await SL.aggregate([
    { $match: { companyId: cObjId, customerType: 'Farmer', customerId: fObjId, ...filterDate } },
    { $group: { _id: null, total: { $sum: '$grandTotal' } } },
  ]).toArray();
  return agg[0]?.total ?? 0;
}

async function show(label, fromStr, toStr) {
  const start = new Date(fromStr);
  const end   = new Date(toStr); end.setHours(23,59,59,999);
  const startMinus1 = new Date(start.getTime() - 1);
  const priorCredit = await credit({ billDate: { $lt: start } });
  const priorDebit  = await debit({ $or: [
    { 'paymentPeriod.toDate': { $lt: start } },
    { 'paymentPeriod.toDate': { $exists: false }, paymentDate: { $lt: start } },
    { 'paymentPeriod.toDate': null, paymentDate: { $lt: start } },
  ]});
  const periodCredit = await credit({ billDate: { $gte: start, $lte: end } });
  const periodDebit  = await debit({ $or: [
    { 'paymentPeriod.toDate': { $gte: start, $lte: end } },
    { 'paymentPeriod.toDate': { $exists: false }, paymentDate: { $gte: start, $lte: end } },
    { 'paymentPeriod.toDate': null, paymentDate: { $gte: start, $lte: end } },
  ]});
  const opening = baseOpening + priorCredit - priorDebit;
  const closing = opening + periodCredit - periodDebit;
  console.log(`${label}  ${fromStr} → ${toStr}`);
  console.log(`  opening (carry from before): ${opening}`);
  console.log(`  period credit / debit:       ${periodCredit} / ${periodDebit}`);
  console.log(`  closing balance:             ${closing}\n`);
}

console.log(`Base opening (ProducerOpening.cfAdvance): ${baseOpening}\n`);
await show('April', '2026-04-01', '2026-04-30');
await show('May  ', '2026-05-01', '2026-05-31');
await show('Cycle 1', '2026-04-01', '2026-04-15');
await show('Cycle 2', '2026-04-16', '2026-04-30');
await show('Cycle 3', '2026-05-01', '2026-05-15');

await mongoose.disconnect();
