import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

await mongoose.connect(process.env.MONGODB_URI);
const coll = mongoose.connection.collection('paymentregisters');
const fp   = mongoose.connection.collection('farmerpayments');

const target = '69db29286b5851d0478bb464';
const farmerTarget = '69db29d66b5851d0478bb56f';

const regs = await coll.find({ companyId: new mongoose.Types.ObjectId(target) }).sort({ fromDate: 1 }).toArray();
console.log('--- Registers ---');
for (const r of regs) {
  console.log(`${r.registerType} ${r.fromDate.toISOString().slice(0,10)} → ${r.toDate.toISOString().slice(0,10)}`);
  console.log(`  createdAt=${r.createdAt?.toISOString()}  updatedAt=${r.updatedAt?.toISOString()}`);
  for (const e of r.entries) {
    console.log(`  farmer=${e.farmerId} cfAdv=${e.cfAdv} cfRec=${e.cfRec} cashAdv=${e.cashAdv} cashRec=${e.cashRec} loanAdv=${e.loanAdv} loanRec=${e.loanRec}`);
  }
}

console.log('\n--- FarmerPayments for target farmer ---');
const fps = await fp.find({
  companyId: new mongoose.Types.ObjectId(target),
  farmerId:  new mongoose.Types.ObjectId(farmerTarget),
}).sort({ paymentDate: 1 }).toArray();
for (const p of fps) {
  console.log(`paymentDate=${p.paymentDate?.toISOString().slice(0,10)} period=${p.paymentPeriod?.fromDate?.toISOString().slice(0,10)}→${p.paymentPeriod?.toDate?.toISOString().slice(0,10)} status=${p.status} source=${p.paymentSource} paid=${p.paidAmount}`);
  for (const d of p.deductions || []) {
    console.log(`  ded: ${d.type} = ${d.amount}`);
  }
}

await mongoose.disconnect();
