// Verify Loan Advance summary opening/advanced/recovery/balance month by month.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

await mongoose.connect(process.env.MONGODB_URI);
const FP = mongoose.connection.collection('farmerpayments');
const PO = mongoose.connection.collection('produceropenings');
const AD = mongoose.connection.collection('advances');

const target = '69db29286b5851d0478bb464';
const farmerTarget = '69db29d66b5851d0478bb56f';
const cObjId = new mongoose.Types.ObjectId(target);
const fObjId = new mongoose.Types.ObjectId(farmerTarget);

const baseOpening = (await PO.findOne({ companyId: cObjId, farmerId: fObjId }))?.loanAdvance ?? 0;

const loanTypes = ['Loan Advance', 'Loan Recovery', 'Loan EMI'];
async function recovery(filterDate) {
  const agg = await FP.aggregate([
    { $match: { companyId: cObjId, farmerId: fObjId, status: { $ne: 'Cancelled' }, 'deductions.type': { $in: loanTypes }, ...filterDate } },
    { $unwind: '$deductions' },
    { $match: { 'deductions.type': { $in: loanTypes } } },
    { $group: { _id: null, total: { $sum: '$deductions.amount' } } },
  ]).toArray();
  return agg[0]?.total ?? 0;
}
async function advanced(filterDate) {
  const agg = await AD.aggregate([
    { $match: { companyId: cObjId, farmerId: fObjId, advanceCategory: 'Loan Advance', status: { $ne: 'Cancelled' }, ...filterDate } },
    { $group: { _id: null, total: { $sum: '$advanceAmount' } } },
  ]).toArray();
  return agg[0]?.total ?? 0;
}

async function show(label, fromStr, toStr) {
  const start = new Date(fromStr);
  const end   = new Date(toStr); end.setHours(23,59,59,999);
  const priorAdv = await advanced({ advanceDate: { $lt: start } });
  const priorRec = await recovery({ $or: [
    { 'paymentPeriod.toDate': { $lt: start } },
    { 'paymentPeriod.toDate': { $exists: false }, paymentDate: { $lt: start } },
    { 'paymentPeriod.toDate': null, paymentDate: { $lt: start } },
  ]});
  const periodAdv = await advanced({ advanceDate: { $gte: start, $lte: end } });
  const periodRec = await recovery({ $or: [
    { 'paymentPeriod.toDate': { $gte: start, $lte: end } },
    { 'paymentPeriod.toDate': { $exists: false }, paymentDate: { $gte: start, $lte: end } },
    { 'paymentPeriod.toDate': null, paymentDate: { $gte: start, $lte: end } },
  ]});
  const opening = baseOpening + priorAdv - priorRec;
  const balance = opening + periodAdv - periodRec;
  console.log(`${label}  ${fromStr} → ${toStr}`);
  console.log(`  opening (carry): ${opening}`);
  console.log(`  advanced / recovery: ${periodAdv} / ${periodRec}`);
  console.log(`  balance:         ${balance}\n`);
}

console.log(`Base opening (ProducerOpening.loanAdvance): ${baseOpening}\n`);
await show('April', '2026-04-01', '2026-04-30');
await show('May  ', '2026-05-01', '2026-05-31');
await show('Cycle 1', '2026-04-01', '2026-04-15');
await show('Cycle 2', '2026-04-16', '2026-04-30');
await show('Cycle 3', '2026-05-01', '2026-05-15');

await mongoose.disconnect();
