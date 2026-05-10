// Run cash + loan + CF summaries against the live DB and dump results.
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
const FA = mongoose.connection.collection('farmers');
const r2 = (v) => Math.round((v || 0) * 100) / 100;

async function summary(coId, kind, fromStr, toStr) {
  const cObjId = new mongoose.Types.ObjectId(coId);
  const start = new Date(fromStr);
  const end   = new Date(toStr); end.setHours(23,59,59,999);

  const cfg = {
    cf:   { openingField: 'cfAdvance',   advCat: null,            dedTypes: ['CF Advance','Cattle Feed','CF Recovery'] },
    cash: { openingField: 'cashAdvance', advCat: 'Cash Advance',  dedTypes: ['Cash Advance','Cash Recovery'] },
    loan: { openingField: 'loanAdvance', advCat: 'Loan Advance',  dedTypes: ['Loan Advance','Loan Recovery','Loan EMI'] },
  }[kind];

  const openings = await PO.find({ companyId: cObjId }).toArray();

  // period activity
  const periodAdvAgg = cfg.advCat ? await AD.aggregate([
    { $match: { companyId: cObjId, advanceCategory: cfg.advCat, advanceDate: { $gte: start, $lte: end }, status: { $ne: 'Cancelled' } } },
    { $group: { _id: '$farmerId', total: { $sum: '$advanceAmount' } } }
  ]).toArray() : [];

  const periodRecAgg = await FP.aggregate([
    { $match: {
        companyId: cObjId, status: { $ne: 'Cancelled' }, 'deductions.type': { $in: cfg.dedTypes },
        $or: [
          { 'paymentPeriod.toDate': { $gte: start, $lte: end } },
          { 'paymentPeriod.toDate': { $exists: false }, paymentDate: { $gte: start, $lte: end } },
          { 'paymentPeriod.toDate': null, paymentDate: { $gte: start, $lte: end } },
        ],
    }},
    { $unwind: '$deductions' },
    { $match: { 'deductions.type': { $in: cfg.dedTypes } } },
    { $group: { _id: '$farmerId', total: { $sum: '$deductions.amount' } } }
  ]).toArray();

  // prior totals
  const priorAdvAgg = cfg.advCat ? await AD.aggregate([
    { $match: { companyId: cObjId, advanceCategory: cfg.advCat, advanceDate: { $lt: start }, status: { $ne: 'Cancelled' } } },
    { $group: { _id: '$farmerId', total: { $sum: '$advanceAmount' } } }
  ]).toArray() : [];

  const priorRecAgg = await FP.aggregate([
    { $match: {
        companyId: cObjId, status: { $ne: 'Cancelled' }, 'deductions.type': { $in: cfg.dedTypes },
        $or: [
          { 'paymentPeriod.toDate': { $lt: start } },
          { 'paymentPeriod.toDate': { $exists: false }, paymentDate: { $lt: start } },
          { 'paymentPeriod.toDate': null, paymentDate: { $lt: start } },
        ],
    }},
    { $unwind: '$deductions' },
    { $match: { 'deductions.type': { $in: cfg.dedTypes } } },
    { $group: { _id: '$farmerId', total: { $sum: '$deductions.amount' } } }
  ]).toArray();

  const map = (arr) => Object.fromEntries(arr.map(x => [String(x._id), r2(x.total)]));
  const periodAdv = map(periodAdvAgg);
  const periodRec = map(periodRecAgg);
  const priorAdv  = map(priorAdvAgg);
  const priorRec  = map(priorRecAgg);

  const rows = [];
  const seen = new Set();
  for (const o of openings) {
    if (!o.farmerId) continue;
    const fid = String(o.farmerId);
    seen.add(fid);
    const baseOpening = r2(o[cfg.openingField] || 0);
    const opening = r2(baseOpening + (priorAdv[fid] || 0) - (priorRec[fid] || 0));
    const advanced = periodAdv[fid] || 0;
    const recovery = periodRec[fid] || 0;
    const balance = r2(opening + advanced - recovery);
    if (opening || advanced || recovery) rows.push({ fid, opening, advanced, recovery, balance });
  }
  // farmers with activity but no opening record
  for (const fid of new Set([...Object.keys(periodAdv), ...Object.keys(periodRec), ...Object.keys(priorAdv), ...Object.keys(priorRec)])) {
    if (seen.has(fid)) continue;
    const opening = r2((priorAdv[fid] || 0) - (priorRec[fid] || 0));
    const advanced = periodAdv[fid] || 0;
    const recovery = periodRec[fid] || 0;
    const balance = r2(opening + advanced - recovery);
    if (opening || advanced || recovery) rows.push({ fid, opening, advanced, recovery, balance });
  }
  return rows;
}

const cos = await mongoose.connection.collection('paymentregisters').distinct('companyId');
for (const co of cos) {
  for (const kind of ['cash','loan','cf']) {
    const r = await summary(String(co), kind, '2026-05-01', '2026-05-31');
    if (r.length) {
      console.log(`${kind.toUpperCase()} co=${co}`);
      for (const x of r) console.log(`  farmer=${x.fid}  opening=${x.opening}  adv=${x.advanced}  rec=${x.recovery}  bal=${x.balance}`);
    }
  }
}
await mongoose.disconnect();
