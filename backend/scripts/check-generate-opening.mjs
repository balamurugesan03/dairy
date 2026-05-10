// Reproduce the new generateProducerPaymentRegister date-ledger opening
// for one farmer, for several cycle starts.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

await mongoose.connect(process.env.MONGODB_URI);
const PO = mongoose.connection.collection('produceropenings');
const FP = mongoose.connection.collection('farmerpayments');
const AD = mongoose.connection.collection('advances');
const SL = mongoose.connection.collection('sales');
const PR = mongoose.connection.collection('producerreceipts');

const target = '69db29286b5851d0478bb464';
const farmerTarget = '69db29d66b5851d0478bb56f';
const cObjId = new mongoose.Types.ObjectId(target);
const fObjId = new mongoose.Types.ObjectId(farmerTarget);

const opening = await PO.findOne({ companyId: cObjId, farmerId: fObjId });
console.log(`ProducerOpening: cf=${opening?.cfAdvance ?? 0}  cash=${opening?.cashAdvance ?? 0}  loan=${opening?.loanAdvance ?? 0}\n`);

async function priorOpening(start) {
  start = new Date(start);
  // CF
  const cfCredit = (await SL.aggregate([
    { $match: { companyId: cObjId, customerType: 'Farmer', customerId: fObjId, billDate: { $lt: start } } },
    { $group: { _id: null, total: { $sum: '$grandTotal' } } },
  ]).toArray())[0]?.total || 0;
  const cfDebit = (await FP.aggregate([
    { $match: { companyId: cObjId, farmerId: fObjId, status: { $ne: 'Cancelled' }, 'deductions.type': { $in: ['CF Advance','Cattle Feed','CF Recovery'] }, paymentDate: { $lt: start } } },
    { $unwind: '$deductions' },
    { $match: { 'deductions.type': { $in: ['CF Advance','Cattle Feed','CF Recovery'] } } },
    { $group: { _id: null, total: { $sum: '$deductions.amount' } } },
  ]).toArray())[0]?.total || 0;
  const cfReceipt = (await PR.aggregate([
    { $match: { companyId: cObjId, farmerId: fObjId, receiptType: 'CF Advance', status: { $ne: 'Cancelled' }, receiptDate: { $lt: start } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]).toArray())[0]?.total || 0;
  const cfOpen = Math.max(0, (opening?.cfAdvance || 0) + cfCredit - cfDebit - cfReceipt);

  // Cash
  const cashCredit = (await AD.aggregate([
    { $match: { companyId: cObjId, farmerId: fObjId, advanceCategory: 'Cash Advance', status: { $ne: 'Cancelled' }, advanceDate: { $lt: start } } },
    { $group: { _id: null, total: { $sum: '$advanceAmount' } } },
  ]).toArray())[0]?.total || 0;
  const cashDebit = (await FP.aggregate([
    { $match: { companyId: cObjId, farmerId: fObjId, status: { $ne: 'Cancelled' }, 'deductions.type': { $in: ['Cash Advance','Cash Recovery'] }, paymentDate: { $lt: start } } },
    { $unwind: '$deductions' },
    { $match: { 'deductions.type': { $in: ['Cash Advance','Cash Recovery'] } } },
    { $group: { _id: null, total: { $sum: '$deductions.amount' } } },
  ]).toArray())[0]?.total || 0;
  const cashOpen = Math.max(0, (opening?.cashAdvance || 0) + cashCredit - cashDebit);

  // Loan
  const loanCredit = (await AD.aggregate([
    { $match: { companyId: cObjId, farmerId: fObjId, advanceCategory: 'Loan Advance', status: { $ne: 'Cancelled' }, advanceDate: { $lt: start } } },
    { $group: { _id: null, total: { $sum: '$advanceAmount' } } },
  ]).toArray())[0]?.total || 0;
  const loanDebit = (await FP.aggregate([
    { $match: { companyId: cObjId, farmerId: fObjId, status: { $ne: 'Cancelled' }, 'deductions.type': { $in: ['Loan Advance','Loan Recovery','Loan EMI'] }, paymentDate: { $lt: start } } },
    { $unwind: '$deductions' },
    { $match: { 'deductions.type': { $in: ['Loan Advance','Loan Recovery','Loan EMI'] } } },
    { $group: { _id: null, total: { $sum: '$deductions.amount' } } },
  ]).toArray())[0]?.total || 0;
  const loanOpen = Math.max(0, (opening?.loanAdvance || 0) + loanCredit - loanDebit);

  return { cf: cfOpen, cash: cashOpen, loan: loanOpen };
}

console.log('Cycle Apr 1-15 → opening as of Apr 1:', await priorOpening('2026-04-01'));
console.log('Cycle Apr 16-30 → opening as of Apr 16:', await priorOpening('2026-04-16'));
console.log('Cycle May 1-15 → opening as of May 1:', await priorOpening('2026-05-01'));
console.log('Cycle May 16-30 → opening as of May 16:', await priorOpening('2026-05-16'));

await mongoose.disconnect();
